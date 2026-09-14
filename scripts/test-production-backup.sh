#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
TMP="$(mktemp -d)"
trap 'rm -rf -- "$TMP"' EXIT
fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
assert_file_contains() { grep -q -- "$2" "$1" || fail "$1 does not contain $2"; }

# Isolate the runner beside a deterministic fake canonical engine.
mkdir -p "$TMP/repo/scripts" "$TMP/bin"
cp "$ROOT/scripts/run-production-backup.sh" "$TMP/repo/scripts/"
cat >"$TMP/repo/scripts/backup-db.sh" <<'FAKE'
#!/usr/bin/env bash
printf '%s\n' "$*" >"$CALLS"
printf 'timestamp=x component=postgres_backup event=backup_created status=success result=LOCAL_BACKUP_SUCCESS artifact=%s/nexogestao_backup_test.sql.gz\n' "$BACKUP_DIR"
exit "${FAKE_EXIT:-0}"
FAKE
chmod +x "$TMP/repo/scripts/"*.sh
cat >"$TMP/bin/aws" <<'FAKE'
#!/usr/bin/env bash
exit 0
FAKE
chmod +x "$TMP/bin/aws"
export PATH="$TMP/bin:$PATH" CALLS="$TMP/calls" BACKUP_DIR="$TMP/artifacts"
mkdir "$BACKUP_DIR"
ENV_FILE="$TMP/backup.env"
cat >"$ENV_FILE" <<EOF
BACKUP_MODE=local
BACKUP_STATE_DIR=$TMP/state
POSTGRES_USER=secret-user
POSTGRES_DB=secret-db
DATABASE_URL=postgresql://secret-password@example/db
EOF
NEXO_BACKUP_ENV_FILE="$ENV_FILE" "$TMP/repo/scripts/run-production-backup.sh" >/dev/null
[[ -z "$(cat "$CALLS")" ]] || fail 'local mode passed an argument'
assert_file_contains "$TMP/state/last-success.json" '"reasonCode":"BACKUP_SUCCESS"'
! grep -Eq 'secret-user|secret-db|secret-password|DATABASE_URL' "$TMP/state/"*.json || fail 'state leaked a secret'

sed -i 's/BACKUP_MODE=local/BACKUP_MODE=local_and_offsite/' "$ENV_FILE"
printf 'BACKUP_S3_BUCKET=placeholder-bucket\n' >>"$ENV_FILE"
NEXO_BACKUP_ENV_FILE="$ENV_FILE" "$TMP/repo/scripts/run-production-backup.sh" >/dev/null
[[ "$(cat "$CALLS")" == --upload ]] || fail 'offsite mode did not pass --upload'
assert_file_contains "$TMP/state/last-success.json" '"offsiteUpload":"uploaded"'

sed -i 's/BACKUP_MODE=local_and_offsite/BACKUP_MODE=invalid/' "$ENV_FILE"
if NEXO_BACKUP_ENV_FILE="$ENV_FILE" "$TMP/repo/scripts/run-production-backup.sh" >/dev/null 2>&1; then fail 'invalid mode succeeded'; fi
assert_file_contains "$TMP/state/last-failure.json" '"reasonCode":"CONFIG_INVALID"'
sed -i 's/BACKUP_MODE=invalid/BACKUP_MODE=local/' "$ENV_FILE"
if FAKE_EXIT=23 NEXO_BACKUP_ENV_FILE="$ENV_FILE" "$TMP/repo/scripts/run-production-backup.sh" >/dev/null 2>&1; then fail 'engine failure succeeded'; else rc=$?; fi
[[ "$rc" == 23 ]] || fail "engine exit code was $rc, expected 23"
assert_file_contains "$TMP/state/last-failure.json" '"exitCode":23'

# Static consolidation invariants.
! grep -Eq 'pg_dump|gzip|sha256sum|RETENTION_DAYS|aws s3' "$ROOT/infra/backup/run-backup.sh" || fail 'legacy shim contains engine behavior'
assert_file_contains "$ROOT/infra/cron/nexogestao-backup.cron" 'scripts/run-production-backup.sh'
! grep -q '/home/ubuntu' "$ROOT/infra/cron/nexogestao-backup.cron" || fail 'cron hardcodes /home/ubuntu'
[[ "$(rg -l 'RETENTION_DAYS=' "$ROOT/scripts/backup-db.sh" "$ROOT/infra/backup/run-backup.sh" | wc -l)" == 1 ]] || fail 'retention has multiple engines'

# The canonical lock admits only one dump. The losing invocation is fail-closed.
mkdir -p "$TMP/lock-bin" "$TMP/lock-backups"
cat >"$TMP/lock-bin/pg_dump" <<'FAKE'
#!/usr/bin/env bash
printf 'call\n' >>"$DUMP_CALLS"
sleep 1
printf '%s\n' 'SELECT 1;'
FAKE
chmod +x "$TMP/lock-bin/pg_dump"
export DUMP_CALLS="$TMP/dump-calls"
common=(BACKUP_DIR="$TMP/lock-backups" POSTGRES_USER=nexo POSTGRES_DB=nexo POSTGRES_HOST=localhost RETENTION_DAYS=30 PATH="$TMP/lock-bin:$PATH")
env "${common[@]}" "$ROOT/scripts/backup-db.sh" >"$TMP/one.log" 2>&1 & first=$!
for _ in {1..50}; do
  [[ -d "$TMP/lock-backups/.nexogestao-backup.lock" ]] && break
  sleep 0.02
done
[[ -d "$TMP/lock-backups/.nexogestao-backup.lock" ]] || { cat "$TMP/one.log" >&2; fail 'first backup did not acquire lock'; }
if env "${common[@]}" "$ROOT/scripts/backup-db.sh" >"$TMP/two.log" 2>&1; then second_rc=0; else second_rc=$?; fi
wait "$first"
[[ "$second_rc" != 0 ]] || fail 'concurrent backup succeeded'
[[ "$(wc -l <"$DUMP_CALLS")" == 1 ]] || fail 'concurrent runs executed multiple dumps'
assert_file_contains "$TMP/two.log" 'canonical'
printf 'PASS: production backup runner and consolidation contracts\n'
