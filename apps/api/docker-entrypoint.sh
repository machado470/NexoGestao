#!/usr/bin/env sh
set -e

log() {
  echo "[nexogestao] $*"
}

# -----------------------------------------------------------------------------
# Resolve DB params:
# - Prefer DB_* env vars if provided
# - Otherwise parse DATABASE_URL (what docker-compose already provides)
# -----------------------------------------------------------------------------
DB_HOST="${DB_HOST:-}"
DB_PORT="${DB_PORT:-}"
DB_NAME="${DB_NAME:-}"
DB_USER="${DB_USER:-}"
DB_PASSWORD="${DB_PASSWORD:-}"

DATABASE_URL="${DATABASE_URL:-}"

if [ -n "$DATABASE_URL" ]; then
  # Parse via Node (reliable, avoids sed regex hell)
  PARSED="$(node -e '
    try {
      const u = new URL(process.env.DATABASE_URL);
      const host = u.hostname || "";
      const port = u.port || "5432";
      const user = decodeURIComponent(u.username || "");
      const pass = decodeURIComponent(u.password || "");
      const db = (u.pathname || "").replace(/^\//, "");
      console.log([host, port, user, pass, db].join("|"));
    } catch (e) {
      process.exit(0);
    }
  ' 2>/dev/null || true)"

  if [ -n "$PARSED" ]; then
    P_HOST="$(echo "$PARSED" | cut -d'|' -f1)"
    P_PORT="$(echo "$PARSED" | cut -d'|' -f2)"
    P_USER="$(echo "$PARSED" | cut -d'|' -f3)"
    P_PASS="$(echo "$PARSED" | cut -d'|' -f4)"
    P_DB="$(echo "$PARSED" | cut -d'|' -f5)"

    [ -z "$DB_HOST" ] && DB_HOST="$P_HOST"
    [ -z "$DB_PORT" ] && DB_PORT="$P_PORT"
    [ -z "$DB_USER" ] && DB_USER="$P_USER"
    [ -z "$DB_PASSWORD" ] && DB_PASSWORD="$P_PASS"
    [ -z "$DB_NAME" ] && DB_NAME="$P_DB"
  fi
fi

# Hard defaults (only if still empty)
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-nexogestao}"
DB_USER="${DB_USER:-postgres}"
DB_PASSWORD="${DB_PASSWORD:-postgres}"

# compat com docker-compose.yml
DB_WAIT_SECONDS="${DB_WAIT_SECONDS:-40}"

# psql/pg_isready use this (avoid password prompt)
export PGPASSWORD="$DB_PASSWORD"
export PGCONNECT_TIMEOUT="${PGCONNECT_TIMEOUT:-5}"

SEED_MODE="$(echo "${SEED_MODE:-none}" | tr '[:upper:]' '[:lower:]')"
FORCE_SEED="${FORCE_SEED:-0}"

# 1 = roda migrate deploy automaticamente quando banco está vazio/sem schema
AUTO_MIGRATE="${AUTO_MIGRATE:-1}"

log "NODE_ENV=${NODE_ENV:-}"
log "db resolved host=${DB_HOST} port=${DB_PORT} db=${DB_NAME} user=${DB_USER}"
log "waiting for postgres (timeout=${DB_WAIT_SECONDS}s)..."

i=0
while ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; do
  i=$((i + 1))
  if [ "$i" -ge "$DB_WAIT_SECONDS" ]; then
    log "postgres not ready after ${DB_WAIT_SECONDS}s"
    exit 1
  fi
  sleep 1
done

log "postgres is ready"
log "checking schema (_prisma_migrations)..."

SCHEMA_EXISTS="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
"select 1 from information_schema.tables where table_schema='public' and table_name='_prisma_migrations' limit 1;" \
2>/dev/null | tr -d '[:space:]')"

if [ "$SCHEMA_EXISTS" = "1" ]; then
  log "schema detected"
else
  if [ "$AUTO_MIGRATE" = "1" ]; then
    log "schema not detected -> running prisma migrate deploy"
    pnpm prisma:migrate:deploy
  else
    log "schema not detected and AUTO_MIGRATE!=1 -> skipping migrate"
  fi
fi

should_seed_demo() {
  # seed demo só quando banco ainda não tem customers
  COUNT_CUSTOMERS="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -tAc \
"select count(*) from \"Customer\";" 2>/dev/null | tr -d '[:space:]')"

  if [ -z "$COUNT_CUSTOMERS" ]; then
    COUNT_CUSTOMERS="0"
  fi

  [ "$COUNT_CUSTOMERS" = "0" ]
}

if [ "$FORCE_SEED" = "1" ]; then
  log "FORCE_SEED=1 -> running seed (SEED_MODE=${SEED_MODE})"
  pnpm prisma:seed
else
  if [ "$SEED_MODE" = "demo" ]; then
    if should_seed_demo; then
      log "SEED_MODE=demo and db has no customers -> running seed"
      pnpm prisma:seed
    else
      log "SEED_MODE=demo but customers already exist -> skipping seed"
    fi
  else
    log "SEED_MODE=${SEED_MODE} -> skipping seed"
  fi
fi

log "starting node"
exec node dist/main.js
