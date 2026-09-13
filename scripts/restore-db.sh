#!/usr/bin/env bash
# Safe non-production restore of canonical plain-SQL gzip backups.
set -euo pipefail
umask 077

NON_INTERACTIVE=false
BACKUP_FILE=""
DB_CONTAINER="${DB_CONTAINER:-}"
FAIL_REASON="unexpected_error"
log() { printf 'timestamp=%s component=postgres_restore event=%s status=%s %s\n' "$(date -u +%FT%TZ)" "$1" "$2" "${3:-}"; }
fail() { FAIL_REASON="$*"; exit 1; }
cleanup() {
  local rc=$?
  if ((rc != 0)); then
    log restore_failed failed "reason=$(printf %q "$FAIL_REASON") exit_code=$rc" >&2
  fi
}
trap cleanup EXIT INT TERM

while (($#)); do
  case "$1" in
    --non-interactive) NON_INTERACTIVE=true; shift ;;
    --container) [[ $# -ge 2 ]] || fail "--container requires a value"; DB_CONTAINER="$2"; shift 2 ;;
    --*) fail "unknown argument: $1" ;;
    *) [[ -z "$BACKUP_FILE" ]] || fail "only one backup file is accepted"; BACKUP_FILE="$1"; shift ;;
  esac
done
[[ -n "$BACKUP_FILE" ]] || fail "usage: restore-db.sh [--non-interactive] [--container NAME] FILE.sql.gz"
[[ "$BACKUP_FILE" == *.sql.gz && "$(basename "$BACKUP_FILE")" == nexogestao_backup_*.sql.gz ]] || fail "unexpected backup filename"
[[ -f "$BACKUP_FILE" ]] || fail "backup file not found"
CHECKSUM_FILE="$BACKUP_FILE.sha256"
[[ -f "$CHECKSUM_FILE" ]] || fail "required checksum sidecar not found"
[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL is required"

TARGET="$(node -e 'const u=new URL(process.env.DATABASE_URL); if(u.protocol!=="postgresql:"&&u.protocol!=="postgres:")process.exit(2); console.log(`${u.hostname}|${u.port||"5432"}|${u.pathname.slice(1)}`)' 2>/dev/null)" || fail "DATABASE_URL is not a valid PostgreSQL URL"
IFS='|' read -r TARGET_HOST TARGET_PORT TARGET_DB <<<"$TARGET"
[[ -n "$TARGET_HOST" && -n "$TARGET_DB" ]] || fail "DATABASE_URL target is incomplete"
case "${TARGET_HOST,,}" in
  localhost|127.0.0.1) ;;
  *) fail "remote restore targets are prohibited in Phase 2.4" ;;
esac
case "${NODE_ENV:-}" in production) fail "production restore is prohibited in Phase 2.4";; esac
case "${TARGET_HOST,,}:${TARGET_DB,,}" in *prod*|*production*) fail "target resembles production and is prohibited";; esac
log restore_started started "host=$(printf %q "$TARGET_HOST") port=$TARGET_PORT database=$(printf %q "$TARGET_DB") artifact=$(printf %q "$BACKUP_FILE")"

(cd "$(dirname "$BACKUP_FILE")" && sha256sum -c -- "$(basename "$CHECKSUM_FILE")") >/dev/null || fail "checksum verification failed"
gzip -t -- "$BACKUP_FILE" || fail "gzip integrity verification failed"
log checksum_verified success "artifact=$(printf %q "$BACKUP_FILE")"

if [[ "$NON_INTERACTIVE" == true ]]; then
  [[ "${ALLOW_NON_PRODUCTION_RESTORE:-}" == yes ]] || fail "non-interactive restore requires ALLOW_NON_PRODUCTION_RESTORE=yes"
else
  printf 'Target host=%s database=%s. Type RESTORE %s: ' "$TARGET_HOST" "$TARGET_DB" "$TARGET_DB" >&2
  read -r confirmation
  [[ "$confirmation" == "RESTORE $TARGET_DB" ]] || fail "confirmation rejected"
fi

FAIL_REASON="database_restore_failed"
if [[ -n "$DB_CONTAINER" ]] && command -v docker >/dev/null 2>&1 && docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null | grep -qx true; then
  gzip -cd -- "$BACKUP_FILE" | docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:?POSTGRES_USER is required}" -d "$TARGET_DB"
else
  command -v psql >/dev/null || fail "psql is unavailable and DB_CONTAINER is not running"
  gzip -cd -- "$BACKUP_FILE" | psql -v ON_ERROR_STOP=1 "$DATABASE_URL"
fi

cd "$(dirname "${BASH_SOURCE[0]}")/.."
FAIL_REASON="post_restore_migration_failed"
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
FAIL_REASON="post_restore_smoke_failed"
if [[ -n "$DB_CONTAINER" ]]; then
  docker exec "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:?}" -d "$TARGET_DB" -Atqc 'SELECT count(*) FROM "_prisma_migrations"' | grep -Eq '^[1-9][0-9]*$'
else
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc 'SELECT count(*) FROM "_prisma_migrations"' | grep -Eq '^[1-9][0-9]*$'
fi
log restore_completed success "host=$(printf %q "$TARGET_HOST") database=$(printf %q "$TARGET_DB")"
