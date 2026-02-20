#!/usr/bin/env sh
set -eu

echo "[nexogestao] NODE_ENV=${NODE_ENV:-}"
echo "[nexogestao] DATABASE_URL=${DATABASE_URL:-<empty>}"

# tenta extrair host/port/db do DATABASE_URL (best effort)
DB_HOST="$(echo "${DATABASE_URL:-}" | sed -n 's|.*@\([^:/?]*\).*|\1|p' | head -n 1)"
DB_PORT="$(echo "${DATABASE_URL:-}" | sed -n 's|.*:\([0-9]\+\)/.*|\1|p' | head -n 1)"
DB_NAME="$(echo "${DATABASE_URL:-}" | sed -n 's|.*/\([^?]*\)\?.*|\1|p' | head -n 1)"

DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nexogestao}"
DB_USER="${POSTGRES_USER:-postgres}"

echo "[nexogestao] db resolved host=${DB_HOST} port=${DB_PORT} db=${DB_NAME} user=${DB_USER}"
echo "[nexogestao] waiting for postgres (timeout=40s)..."

i=0
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  i=$((i+1))
  if [ "$i" -ge 40 ]; then
    echo "[nexogestao] postgres not ready after 40s"
    echo "[nexogestao] last pg_isready output:"
    pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" || true
    exit 1
  fi
  sleep 1
done

echo "[nexogestao] postgres is ready"
echo "[nexogestao] checking schema (_prisma_migrations)..."

# se existir a tabela de migrations, considera schema presente
SCHEMA_OK="0"
psql "${DATABASE_URL}" -c 'select 1 from "_prisma_migrations" limit 1;' >/dev/null 2>&1 && SCHEMA_OK="1" || true

if [ "$SCHEMA_OK" = "1" ]; then
  echo "[nexogestao] schema detected"
else
  echo "[nexogestao] schema not detected -> running migrate deploy"
  pnpm prisma migrate deploy
fi

# seed controlado por env
if [ "${SEED_MODE:-}" = "demo" ]; then
  # não spammar seed se já tem customer
  HAS_CUSTOMERS="$(psql "${DATABASE_URL}" -tAc 'select count(*) from "Customer";' 2>/dev/null || echo "0")"
  HAS_CUSTOMERS="$(echo "$HAS_CUSTOMERS" | tr -d '[:space:]')"
  if [ "$HAS_CUSTOMERS" != "0" ]; then
    echo "[nexogestao] SEED_MODE=demo but customers already exist -> skipping seed"
  else
    echo "[nexogestao] SEED_MODE=demo -> running seed"
    pnpm seed:demo || pnpm seed || true
  fi
fi

echo "[nexogestao] starting node"
exec node dist/main.js
