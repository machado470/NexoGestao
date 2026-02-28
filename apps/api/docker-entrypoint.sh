#!/usr/bin/env sh
set -eu

echo "[nexogestao] NODE_ENV=${NODE_ENV:-}"
echo "[nexogestao] DATABASE_URL=<hidden>"

APP_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "[nexogestao] app dir=${APP_DIR}"

cd "$APP_DIR"

DB_WAIT_SECONDS="${DB_WAIT_SECONDS:-40}"
AUTO_MIGRATE="${AUTO_MIGRATE:-1}"

DB_HOST="$(echo "${DATABASE_URL:-}" | sed -n 's|.*@\([^:/?]*\).*|\1|p' | head -n 1)"
DB_PORT="$(echo "${DATABASE_URL:-}" | sed -n 's|.*:\([0-9]\+\)/.*|\1|p' | head -n 1)"
DB_NAME="$(echo "${DATABASE_URL:-}" | sed -n 's|.*/\([^?]*\)\?.*|\1|p' | head -n 1)"

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nexogestao}"
DB_USER="${POSTGRES_USER:-postgres}"

echo "[nexogestao] db resolved host=${DB_HOST} port=${DB_PORT} db=${DB_NAME} user=${DB_USER}"
echo "[nexogestao] waiting for postgres (timeout=${DB_WAIT_SECONDS}s)..."

i=0
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  i=$((i+1))
  if [ "$i" -ge "$DB_WAIT_SECONDS" ]; then
    echo "[nexogestao] postgres not ready after ${DB_WAIT_SECONDS}s"
    exit 1
  fi
  sleep 1
done

echo "[nexogestao] postgres is ready"

# ===============================
# MIGRATIONS (CORRETO)
# ===============================
if [ "$AUTO_MIGRATE" = "1" ]; then
  echo "[nexogestao] AUTO_MIGRATE=1 -> running prisma:migrate:deploy"
  pnpm run prisma:migrate:deploy
else
  echo "[nexogestao] AUTO_MIGRATE=0 -> skipping migrations"
fi

# ===============================
# SEED CONTROLADO
# ===============================
if [ "${SEED_MODE:-}" = "demo" ]; then
  echo "[nexogestao] SEED_MODE=demo -> running seed"
  pnpm run prisma:seed || echo "[nexogestao] seed failed"
else
  echo "[nexogestao] seed disabled"
fi

echo "[nexogestao] starting node"
exec node dist/main.js
