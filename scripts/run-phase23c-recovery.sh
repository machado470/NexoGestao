#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -p nexogestao-phase23c -f "$ROOT/docker-compose.phase23c-test.yml")
export DATABASE_URL='postgresql://phase23c:phase23c-local-only@127.0.0.1:55433/phase23c?schema=public'
export REDIS_URL='redis://127.0.0.1:56380/15'
export REDIS_HOST=127.0.0.1 REDIS_PORT=56380 RUN_REAL_INTEGRATION=true

cleanup() { "${COMPOSE[@]}" down --volumes --remove-orphans; }
trap cleanup EXIT INT TERM

wait_for_host_service() {
  local name="$1" port="$2" deadline=$((SECONDS + 30))
  echo "Waiting for $name on host 127.0.0.1:$port..."
  until (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; do
    if (( SECONDS >= deadline )); then
      echo "Timed out waiting for $name host port 127.0.0.1:$port" >&2
      return 1
    fi
    sleep 1
  done
}

wait_for_postgres() {
  local deadline=$((SECONDS + 30))
  if ! command -v pg_isready >/dev/null 2>&1; then
    echo "pg_isready is unavailable; using a bounded host TCP check for PostgreSQL."
    wait_for_host_service PostgreSQL 55433
    return
  fi
  echo "Waiting for PostgreSQL readiness through host port 127.0.0.1:55433..."
  until pg_isready -h 127.0.0.1 -p 55433 -U phase23c -d phase23c >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
      echo "Timed out waiting for PostgreSQL readiness on host 127.0.0.1:55433" >&2
      return 1
    fi
    sleep 1
  done
}

wait_for_redis() {
  local deadline=$((SECONDS + 30)) reply
  if ! command -v redis-cli >/dev/null 2>&1; then
    echo "redis-cli is unavailable; using a bounded host TCP check for Redis."
    wait_for_host_service Redis 56380
    return
  fi
  echo "Waiting for Redis PING through host port 127.0.0.1:56380..."
  until reply="$(redis-cli -h 127.0.0.1 -p 56380 ping 2>/dev/null)" && [[ "$reply" == PONG ]]; do
    if (( SECONDS >= deadline )); then
      echo "Timed out waiting for Redis PING on host 127.0.0.1:56380" >&2
      return 1
    fi
    sleep 1
  done
}

"${COMPOSE[@]}" up -d --wait
wait_for_postgres
wait_for_redis
cd "$ROOT"
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
pnpm --filter ./apps/api test -- \
  test/integration/phase23c-recovery-postgres.integration.spec.ts \
  test/integration/phase23c-recovery-redis.integration.spec.ts \
  test/integration/phase23c-dlq-replay.integration.spec.ts
