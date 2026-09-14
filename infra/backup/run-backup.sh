#!/usr/bin/env bash
# Deprecated compatibility shim. The only backup engine is scripts/backup-db.sh.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
printf 'warning: infra/backup/run-backup.sh is deprecated and non-canonical; use scripts/backup-db.sh\n' >&2
exec "$SCRIPT_DIR/../../scripts/backup-db.sh" "$@"
