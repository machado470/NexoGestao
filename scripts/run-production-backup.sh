#!/usr/bin/env bash
# Canonical non-interactive scheduled-backup runner; backup-db.sh remains the engine.
set -uo pipefail
umask 077

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
ENGINE="$SCRIPT_DIR/backup-db.sh"
STARTED_AT="$(date -u +%FT%TZ)"
STATE_DIR=""
MODE=""

event() { printf 'timestamp=%s component=scheduled_backup event=%s status=%s reason_code=%s\n' "$(date -u +%FT%TZ)" "$1" "$2" "$3"; }
write_state() {
  local result="$1" local_backup="$2" offsite="$3" artifact="$4" exit_code="$5" reason="$6" target tmp snapshot_tmp snapshot
  [[ -n "$STATE_DIR" ]] || return 0
  mkdir -p -- "$STATE_DIR" || return 1
  chmod 700 "$STATE_DIR" || return 1
  target="$STATE_DIR/last-attempt.json"
  tmp="$(mktemp "$STATE_DIR/.backup-state.XXXXXX")" || return 1
  node - "$STARTED_AT" "$(date -u +%FT%TZ)" "$result" "$local_backup" "$offsite" "$artifact" "$exit_code" "$reason" >"$tmp" <<'NODE'
const [startedAt, finishedAt, result, localBackup, offsiteUpload, artifactName, exitCode, reasonCode] = process.argv.slice(2);
process.stdout.write(JSON.stringify({schemaVersion:1,startedAt,finishedAt,result,localBackup,offsiteUpload,artifactName:artifactName||null,exitCode:Number(exitCode),reasonCode})+'\n');
NODE
  chmod 600 "$tmp" || { rm -f "$tmp"; return 1; }
  mv -f -- "$tmp" "$target" || return 1
  if [[ "$result" == success ]]; then
    snapshot="$STATE_DIR/last-success.json"
  else
    snapshot="$STATE_DIR/last-failure.json"
  fi
  snapshot_tmp="$(mktemp "$STATE_DIR/.backup-snapshot.XXXXXX")" || return 1
  cp "$target" "$snapshot_tmp" && chmod 600 "$snapshot_tmp" && mv -f -- "$snapshot_tmp" "$snapshot"
}
config_failure() {
  local reason="${1:-CONFIG_INVALID}" rc="${2:-64}"
  event scheduled_backup_failed failed "$reason" >&2
  write_state failure not_created not_requested "" "$rc" "$reason" || true
  exit "$rc"
}

[[ -n "${NEXO_BACKUP_ENV_FILE:-}" ]] || { event scheduled_backup_failed failed CONFIG_INVALID >&2; exit 64; }
[[ -f "$NEXO_BACKUP_ENV_FILE" && -r "$NEXO_BACKUP_ENV_FILE" ]] || { event scheduled_backup_failed failed CONFIG_INVALID >&2; exit 64; }
# shellcheck disable=SC1090 -- explicit operator-selected file, never a repository .env.
set -a
source "$NEXO_BACKUP_ENV_FILE"
set +a
STATE_DIR="${BACKUP_STATE_DIR:-}"
[[ -n "$STATE_DIR" ]] || config_failure CONFIG_INVALID
command -v node >/dev/null 2>&1 || config_failure DEPENDENCY_MISSING 69
[[ -x "$ENGINE" ]] || config_failure DEPENDENCY_MISSING 69
MODE="${BACKUP_MODE:-}"
case "$MODE" in
  local) args=(); expected_offsite=skipped ;;
  local_and_offsite)
    [[ -n "${BACKUP_S3_BUCKET:-}" ]] || config_failure CONFIG_INVALID
    command -v aws >/dev/null 2>&1 || config_failure DEPENDENCY_MISSING 69
    args=(--upload); expected_offsite=uploaded ;;
  *) config_failure CONFIG_INVALID ;;
esac

event scheduled_backup_started started BACKUP_SUCCESS
output="$(mktemp)" || config_failure UNKNOWN_FAILURE 70
trap 'rm -f -- "$output"' EXIT
"$ENGINE" "${args[@]}" > >(tee "$output") 2> >(tee -a "$output" >&2)
rc=$?
artifact="$(sed -n 's/.* event=backup_created .* artifact=\([^ ]*\).*/\1/p' "$output" | tail -1)"
artifact="$(basename -- "$artifact" 2>/dev/null || true)"
if ((rc == 0)); then
  write_state success created "$expected_offsite" "$artifact" 0 BACKUP_SUCCESS || { event scheduled_backup_failed failed UNKNOWN_FAILURE >&2; exit 70; }
  event scheduled_backup_completed success BACKUP_SUCCESS
  exit 0
fi
if grep -Eq 'OFFSITE_UPLOAD_FAILED|event=offsite_failed' "$output"; then reason=OFFSITE_UPLOAD_FAILED
elif grep -q 'canonical.*backup.*already.*running' "$output"; then reason=LOCKED
elif grep -q 'is required\|unavailable' "$output"; then reason=DEPENDENCY_MISSING
elif grep -q 'event=backup_created' "$output"; then reason=UNKNOWN_FAILURE
else reason=LOCAL_BACKUP_FAILED
fi
local_result=failed
[[ "$reason" == OFFSITE_UPLOAD_FAILED ]] && local_result=created
write_state failure "$local_result" failed "$artifact" "$rc" "$reason" || true
event scheduled_backup_failed failed "$reason" >&2
exit "$rc"
