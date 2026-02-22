#!/usr/bin/env sh
set -eu

echo "[nexogestao] NODE_ENV=${NODE_ENV:-}"
echo "[nexogestao] DATABASE_URL=<hidden>"

# diretório do entrypoint (garante path certo mesmo mudando WORKDIR)
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
echo "[nexogestao] app dir=${APP_DIR}"

cd "$APP_DIR"

# respeita variáveis do compose (se não vierem, defaults seguros)
DB_WAIT_SECONDS="${DB_WAIT_SECONDS:-40}"
AUTO_MIGRATE="${AUTO_MIGRATE:-1}"

# tenta extrair host/port/db do DATABASE_URL (best effort)
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
    echo "[nexogestao] last pg_isready output:"
    pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" || true
    exit 1
  fi
  sleep 1
done

echo "[nexogestao] postgres is ready"

# ------------------------------------------------------------
# MIGRATIONS
# - AUTO_MIGRATE=1: tenta garantir que schema existe
# - se "_prisma_migrations" não existir, roda deploy
# ------------------------------------------------------------
if [ "$AUTO_MIGRATE" = "1" ]; then
  echo "[nexogestao] checking schema (_prisma_migrations)..."

  SCHEMA_OK="0"
  psql "${DATABASE_URL}" -c 'select 1 from "_prisma_migrations" limit 1;' >/dev/null 2>&1 && SCHEMA_OK="1" || true

  if [ "$SCHEMA_OK" = "1" ]; then
    echo "[nexogestao] schema detected"
  else
    echo "[nexogestao] schema not detected -> running migrations (prisma:migrate:deploy)"
    pnpm run prisma:migrate:deploy
  fi
else
  echo "[nexogestao] AUTO_MIGRATE=0 -> skipping migrations"
fi

# ------------------------------------------------------------
# SEED (controlado por env)
# - SEED_MODE=demo: só roda se não existir nenhum Customer
# - FORCE_SEED=1  : força seed mesmo já tendo dados
#
# OBS: no apps/api/package.json existe "prisma:seed"
# ------------------------------------------------------------
if [ "${SEED_MODE:-}" = "demo" ]; then
  HAS_CUSTOMERS="$(psql "${DATABASE_URL}" -tAc 'select count(*) from "Customer";' 2>/dev/null || echo "0")"
  HAS_CUSTOMERS="$(echo "$HAS_CUSTOMERS" | tr -d '[:space:]')"

  if [ "${FORCE_SEED:-}" = "1" ]; then
    echo "[nexogestao] FORCE_SEED=1 -> forcing seed"
    HAS_CUSTOMERS="0"
  fi

  if [ "$HAS_CUSTOMERS" != "0" ]; then
    echo "[nexogestao] SEED_MODE=demo but customers already exist -> skipping seed"
  else
    echo "[nexogestao] SEED_MODE=demo -> running prisma:seed"
    pnpm run prisma:seed || {
      echo "[nexogestao] prisma:seed failed or not found -> skipping seed"
    }
  fi
fi

echo "[nexogestao] starting node"
exec node dist/main.js
