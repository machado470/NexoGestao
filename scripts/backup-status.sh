#!/usr/bin/env bash
# Print factual local state; no health score or inferred availability.
set -euo pipefail
umask 077
[[ -n "${BACKUP_STATE_DIR:-}" ]] || { printf 'BACKUP_STATE_DIR is required\n' >&2; exit 64; }
if [[ "${1:-}" == --check ]]; then
  shift
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
  exec node "$SCRIPT_DIR/check-backup-state.mjs" "$@"
fi
[[ "$#" == 0 ]] || { printf 'Unknown backup-status argument\n' >&2; exit 64; }
state="$BACKUP_STATE_DIR/last-attempt.json"
[[ -r "$state" ]] || { printf 'backup state is unavailable: %s\n' "$state" >&2; exit 1; }
cat -- "$state"
