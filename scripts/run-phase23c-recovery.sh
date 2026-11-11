#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Each invocation owns a new project. Never stop or clean another test/dev stack.
export PHASE23C_COMPOSE_PROJECT="nexogestao-phase23c-$(node -e 'process.stdout.write(require("node:crypto").randomUUID().replaceAll("-", ""))')"
COMPOSE=(docker compose -p "$PHASE23C_COMPOSE_PROJECT" -f "$ROOT/docker-compose.phase23c-test.yml")

cleanup() { "${COMPOSE[@]}" down --remove-orphans; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Allocate different free loopback ports, then bind explicit ports in Docker.
# Explicit bindings stay stable through the stop/start recovery exercises.
allocate_ports() {
  node <<'JS'
const net = require('node:net');
(async () => {
  const servers = [];
  try {
    for (let i = 0; i < 2; i++) {
      const server = net.createServer(); servers.push(server);
      await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    }
    console.log(servers.map(server => server.address().port).join(' '));
  } finally { for (const server of servers) server.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
JS
}

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
    echo "pg_isready is unavailable on the host; checking PostgreSQL inside its container."
    until "${COMPOSE[@]}" exec -T postgres-phase23c pg_isready -U phase23c -d phase23c >/dev/null 2>&1; do
      if (( SECONDS >= deadline )); then
        echo "Timed out waiting for PostgreSQL readiness inside postgres-phase23c" >&2
        return 1
      fi
      sleep 1
    done
    wait_for_host_service PostgreSQL "$PHASE23C_POSTGRES_PORT"
    return
  fi
  echo "Waiting for PostgreSQL readiness through host port 127.0.0.1:$PHASE23C_POSTGRES_PORT..."
  until pg_isready -h 127.0.0.1 -p "$PHASE23C_POSTGRES_PORT" -U phase23c -d phase23c >/dev/null 2>&1; do
    if (( SECONDS >= deadline )); then
      echo "Timed out waiting for PostgreSQL readiness on host 127.0.0.1:$PHASE23C_POSTGRES_PORT" >&2
      return 1
    fi
    sleep 1
  done
}

wait_for_redis() {
  local deadline=$((SECONDS + 30)) reply
  if ! command -v redis-cli >/dev/null 2>&1; then
    echo "redis-cli is unavailable; using a bounded host TCP check for Redis."
    wait_for_host_service Redis "$PHASE23C_REDIS_PORT"
    return
  fi
  echo "Waiting for Redis PING through host port 127.0.0.1:$PHASE23C_REDIS_PORT..."
  until reply="$(redis-cli -h 127.0.0.1 -p "$PHASE23C_REDIS_PORT" ping 2>/dev/null)" && [[ "$reply" == PONG ]]; do
    if (( SECONDS >= deadline )); then
      echo "Timed out waiting for Redis PING on host 127.0.0.1:$PHASE23C_REDIS_PORT" >&2
      return 1
    fi
    sleep 1
  done
}

for attempt in 1 2 3; do
  ports="$(allocate_ports)"
  read -r PHASE23C_POSTGRES_PORT PHASE23C_REDIS_PORT <<< "$ports"
  export PHASE23C_POSTGRES_PORT PHASE23C_REDIS_PORT
  echo "Recovery project=$PHASE23C_COMPOSE_PROJECT postgres=$PHASE23C_POSTGRES_PORT redis=$PHASE23C_REDIS_PORT attempt=$attempt"
  if "${COMPOSE[@]}" up -d --wait; then break; fi
  # Another process may bind a selected port between allocation and Docker up.
  "${COMPOSE[@]}" down --remove-orphans
  if [[ "$attempt" == 3 ]]; then exit 1; fi
done
export DATABASE_URL="postgresql://phase23c:phase23c-local-only@127.0.0.1:$PHASE23C_POSTGRES_PORT/phase23c?schema=public"
export REDIS_URL="redis://127.0.0.1:$PHASE23C_REDIS_PORT/15"
export REDIS_HOST=127.0.0.1 REDIS_PORT="$PHASE23C_REDIS_PORT" RUN_REAL_INTEGRATION=true
wait_for_postgres
wait_for_redis
cd "$ROOT"
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
pnpm --filter ./apps/api test -- \
  test/integration/phase23c-recovery-postgres.integration.spec.ts \
  test/integration/phase23c-recovery-redis.integration.spec.ts \
  test/integration/phase23c-dlq-replay.integration.spec.ts
