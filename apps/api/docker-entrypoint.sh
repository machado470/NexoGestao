#!/bin/sh
set -e

cd /app/apps/api

echo "[nexogestao] starting api"
echo "[nexogestao] NODE_ENV=${NODE_ENV:-unknown}"

AUTO_MIGRATE="${AUTO_MIGRATE:-0}"
SEED_MODE="${SEED_MODE:-none}"        # demo|none
FORCE_SEED="${FORCE_SEED:-0}"         # 1 força seed mesmo com schema
schema="./prisma/schema.prisma"

DB_WAIT_SECONDS="${DB_WAIT_SECONDS:-40}"

POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
POSTGRES_DB="${POSTGRES_DB:-nexogestao}"

psql_ok() {
  PGPASSWORD="$POSTGRES_PASSWORD" psql \
    -h "$POSTGRES_HOST" \
    -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" \
    -tAc "$1" 2>/dev/null
}

has_schema() {
  v="$(psql_ok "select 1 from information_schema.tables where table_schema='public' and table_name='_prisma_migrations' limit 1;")"
  echo "$v" | tr -d ' \n\r' | grep -q "1"
}

run_seed_demo() {
  echo "[nexogestao] SEED_MODE=demo -> running prisma db seed"
  pnpm exec prisma db seed --schema "$schema"
  echo "[nexogestao] seed demo applied"
}

echo "[nexogestao] waiting for postgres host=${POSTGRES_HOST} db=${POSTGRES_DB} (timeout=${DB_WAIT_SECONDS}s)..."

i=0
while [ "$i" -lt "$DB_WAIT_SECONDS" ]; do
  if psql_ok "select 1;" >/dev/null 2>&1; then
    echo "[nexogestao] postgres is ready"
    break
  fi
  i=$((i+1))
  sleep 1
done

if [ "$i" -ge "$DB_WAIT_SECONDS" ]; then
  echo "[nexogestao] ERROR: postgres did not respond in time"
  exit 1
fi

echo "[nexogestao] checking schema (_prisma_migrations)..."
if has_schema; then
  echo "[nexogestao] schema detected"
  DB_WAS_EMPTY="0"
else
  echo "[nexogestao] schema NOT detected (db likely empty)"
  DB_WAS_EMPTY="1"

  if [ "$AUTO_MIGRATE" = "1" ]; then
    echo "[nexogestao] AUTO_MIGRATE=1 -> running prisma migrate deploy"
    pnpm exec prisma migrate deploy --schema "$schema"

    echo "[nexogestao] re-checking schema after migrate..."
    if has_schema; then
      echo "[nexogestao] migrations applied ok"
    else
      echo "[nexogestao] ERROR: migrate finished but schema still not detected"
      exit 1
    fi
  else
    echo "[nexogestao] ERROR: AUTO_MIGRATE=0 and schema missing"
    echo "[nexogestao] HINT: run:"
    echo "  docker compose run --rm --entrypoint sh api -lc 'cd /app/apps/api && pnpm exec prisma migrate deploy'"
    echo "  docker compose run --rm --entrypoint sh api -lc 'cd /app/apps/api && pnpm exec prisma db seed'"
    exit 1
  fi
fi

# ✅ Seed só quando DB era vazio, ou quando você força
if [ "$SEED_MODE" = "demo" ]; then
  if [ "$DB_WAS_EMPTY" = "1" ] || [ "$FORCE_SEED" = "1" ]; then
    run_seed_demo
  else
    echo "[nexogestao] SEED_MODE=demo but schema exists -> skipping seed (set FORCE_SEED=1 to force)"
  fi
elif [ "$SEED_MODE" = "none" ]; then
  echo "[nexogestao] SEED_MODE=none -> skipping seed"
else
  echo "[nexogestao] ERROR: invalid SEED_MODE=$SEED_MODE (use demo|none)"
  exit 1
fi

echo "[nexogestao] starting node"
exec node dist/main.js
