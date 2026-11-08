#!/usr/bin/env sh
set -eu

# Image artifacts are immutable: generation/build/migration/seed are explicit jobs.
if [ "${AUTO_MIGRATE:-0}" != "0" ] || [ -n "${SEED_MODE:-}" ]; then
  echo '[nexogestao] FATAL: use an explicit maintenance job for migrations/seeds' >&2
  exit 1
fi
cd /app/apps/api
node /app/scripts/wait-for-postgres.mjs
REQUIRE_DATABASE_SMOKE="${REQUIRE_DATABASE_SMOKE:-1}" node /app/scripts/check-operational-actions-db.mjs
exec "$@"
