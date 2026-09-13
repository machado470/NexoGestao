#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -p nexogestao-phase23c -f "$ROOT/docker-compose.phase23c-test.yml")
export DATABASE_URL='postgresql://phase23c:phase23c-local-only@127.0.0.1:55433/phase23c?schema=public'
export REDIS_URL='redis://127.0.0.1:56380/15'
export REDIS_HOST=127.0.0.1 REDIS_PORT=56380 RUN_REAL_INTEGRATION=true

cleanup() { "${COMPOSE[@]}" down --volumes --remove-orphans; }
trap cleanup EXIT INT TERM

"${COMPOSE[@]}" up -d --wait
cd "$ROOT"
pnpm exec prisma db push --skip-generate --schema prisma/schema.prisma
pnpm --filter ./apps/api test -- \
  test/integration/phase23c-recovery-postgres.integration.spec.ts \
  test/integration/phase23c-recovery-redis.integration.spec.ts \
  test/integration/phase23c-dlq-replay.integration.spec.ts
