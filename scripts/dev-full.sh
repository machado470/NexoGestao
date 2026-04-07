#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker não encontrado. Instale Docker Desktop/Engine antes de rodar pnpm dev:full."
  exit 1
fi

if [ ! -f .env ]; then
  echo "ℹ️ .env não encontrado. Copiando .env.example -> .env"
  cp .env.example .env
fi

source .env
export DATABASE_URL REDIS_URL JWT_SECRET PORT API_PORT REDIS_HOST REDIS_PORT

if [ -z "${DATABASE_URL:-}" ] || [ -z "${REDIS_URL:-}" ] || [ -z "${JWT_SECRET:-}" ]; then
  echo "❌ DATABASE_URL, REDIS_URL e JWT_SECRET são obrigatórios no .env"
  exit 1
fi

if [ -z "${API_PORT:-}" ]; then
  export API_PORT="${PORT:-3001}"
fi

if [ -z "${REDIS_HOST:-}" ] || [ -z "${REDIS_PORT:-}" ]; then
  REDIS_HOST="$(node -e "const u=new URL(process.env.REDIS_URL); process.stdout.write(u.hostname)")"
  REDIS_PORT="$(node -e "const u=new URL(process.env.REDIS_URL); process.stdout.write(u.port || '6379')")"
  export REDIS_HOST REDIS_PORT
fi

echo "🧱 Subindo Postgres e Redis via Docker Compose..."
docker compose up -d postgres redis

echo "⏳ Aguardando Postgres ficar healthy..."
until docker inspect --format='{{.State.Health.Status}}' nexogestao_postgres 2>/dev/null | grep -q healthy; do
  sleep 2
done

echo "⏳ Aguardando Redis responder PING..."
until docker exec nexogestao_redis redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 2
done

echo "🗃️ Executando migrations..."
pnpm --filter ./apps/api run prisma:migrate:deploy

echo "🌱 Executando seed..."
pnpm --filter ./apps/api run prisma:seed

echo "🚀 Iniciando API + Web..."
trap 'kill 0' EXIT
pnpm --filter ./apps/api run dev &
pnpm --filter ./apps/web run dev
