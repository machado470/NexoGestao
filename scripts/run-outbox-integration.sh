#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# Each invocation owns its stack; Docker allocates a free loopback port by default.
compose_project="nexogestao-outbox-$(node -e 'process.stdout.write(require("node:crypto").randomUUID().replaceAll("-", ""))')"
database="nexogestao_outbox_test"
COMPOSE=(docker compose -p "$compose_project" -f "$ROOT/docker-compose.outbox-test.yml")
cleanup() { "${COMPOSE[@]}" down --remove-orphans; }
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

"${COMPOSE[@]}" up -d --wait
binding="$("${COMPOSE[@]}" port postgres-outbox-test 5432)"
if [[ ! "$binding" =~ ^127\.0\.0\.1:([0-9]+)$ ]]; then
  echo "Unexpected Outbox PostgreSQL binding: $binding" >&2
  exit 1
fi
port="${BASH_REMATCH[1]}"
url="postgresql://postgres:postgres@127.0.0.1:${port}/${database}?schema=public"
echo "Outbox project=$compose_project postgres=$port"
cd "$ROOT"
DATABASE_URL="$url" pnpm prisma:migrate:deploy
DATABASE_URL="$url" pnpm prisma:generate
DATABASE_URL="$url" RUN_REAL_OUTBOX_INTEGRATION=true pnpm --filter ./apps/api test -- test/integration/outbox-postgres.integration.spec.ts
