#!/usr/bin/env sh
set -e

log() {
  echo "[nexogestao] $*"
}

APP_DIR="/app/apps/api"
DIST_MAIN="$APP_DIR/dist/main.js"

log "NODE_ENV=${NODE_ENV:-}"
log "DATABASE_URL=${DATABASE_URL:+<hidden>}"
log "app dir=$APP_DIR"

cd "$APP_DIR"

# ---- quick filesystem diagnostics
log "pwd=$(pwd)"
log "ls -la (app dir):"
ls -la | sed -n "1,120p" || true

# ---- wait for postgres
DB_WAIT_SECONDS="${DB_WAIT_SECONDS:-40}"

# Resolve DB params from DATABASE_URL
# expected: postgresql://user:pass@host:port/db?schema=public
DB_URL="${DATABASE_URL:-}"
DB_HOST="$(echo "$DB_URL" | sed -n 's|.*@\(.*\):.*|\1|p')"
DB_PORT="$(echo "$DB_URL" | sed -n 's|.*:\([0-9]\+\)/.*|\1|p')"
DB_NAME="$(echo "$DB_URL" | sed -n 's|.*/\([^?]*\).*|\1|p')"
DB_USER="$(echo "$DB_URL" | sed -n 's|.*//\([^:]*\):.*|\1|p')"

log "db resolved host=${DB_HOST:-postgres} port=${DB_PORT:-5432} db=${DB_NAME:-nexogestao} user=${DB_USER:-postgres}"
log "waiting for postgres (timeout=${DB_WAIT_SECONDS}s)..."

i=0
while [ "$i" -lt "$DB_WAIT_SECONDS" ]; do
  if pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USER:-postgres}" -d "${DB_NAME:-nexogestao}" >/dev/null 2>&1; then
    log "postgres is ready"
    break
  fi
  i=$((i+1))
  sleep 1
done

# ---- migrations
if [ "${AUTO_MIGRATE:-0}" = "1" ]; then
  log "AUTO_MIGRATE=1 -> running prisma:migrate:deploy"
  pnpm run prisma:migrate:deploy
else
  log "AUTO_MIGRATE disabled"
fi

# ---- seed
if [ "${SEED_MODE:-}" != "" ]; then
  log "seed enabled (SEED_MODE=$SEED_MODE) -> running prisma:seed"
  pnpm run prisma:seed
else
  log "seed disabled"
fi

# ---- if a command was provided, run it (DEV mode, custom commands, etc.)
if [ "$#" -gt 0 ]; then
  log "exec custom command: $*"
  exec "$@"
fi

# ---- otherwise, default to production start (dist)
if [ ! -f "$DIST_MAIN" ]; then
  log "dist missing: $DIST_MAIN"
  log "attempting build inside container..."
  pnpm run build
fi

if [ ! -f "$DIST_MAIN" ]; then
  log "FATAL: still missing $DIST_MAIN"
  log "tree dist (if exists):"
  find "$APP_DIR" -maxdepth 3 -type d -name dist -print -exec ls -la {} \; || true
  exit 1
fi

log "starting node: $DIST_MAIN"
exec node "$DIST_MAIN"
