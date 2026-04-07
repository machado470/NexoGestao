#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker não encontrado. Instale Docker Desktop/Engine antes de rodar pnpm dev:full."
  exit 1
fi

if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "ℹ️ .env não encontrado. Copiando .env.example -> .env"
    cp .env.example .env
  elif [ -f examples/env/.env.example ]; then
    echo "ℹ️ .env não encontrado. Copiando examples/env/.env.example -> .env"
    cp examples/env/.env.example .env
  fi
fi

if [ ! -f .env ]; then
  echo "❌ .env não encontrado e nenhum template disponível para cópia automática."
  echo "   Crie .env na raiz com DATABASE_URL, REDIS_URL e JWT_SECRET."
  exit 1
fi

set -a
source .env
set +a

required_vars=(DATABASE_URL REDIS_URL JWT_SECRET)
missing_vars=()
for var_name in "${required_vars[@]}"; do
  if [ -z "${!var_name:-}" ]; then
    missing_vars+=("$var_name")
  fi
done

if [ "${#missing_vars[@]}" -gt 0 ]; then
  echo "❌ Variáveis obrigatórias ausentes no .env: ${missing_vars[*]}"
  echo "   Exemplo mínimo:"
  echo "   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexogestao?schema=public"
  echo "   REDIS_URL=redis://localhost:6379"
  echo "   JWT_SECRET=change-this-secret-in-local"
  echo "   Dica: rode cp .env.example .env e ajuste os valores locais."
  exit 1
fi

export DATABASE_URL REDIS_URL JWT_SECRET PORT API_PORT REDIS_HOST REDIS_PORT

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
