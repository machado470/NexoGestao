#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker não encontrado. Instale Docker Desktop/Engine antes de rodar pnpm dev:full."
  exit 1
fi

if docker compose version >/dev/null 2>&1; then
  COMPOSE_CMD=(docker compose)
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE_CMD=(docker-compose)
else
  echo "❌ Docker Compose não encontrado. Instale o plugin 'docker compose' ou 'docker-compose'."
  exit 1
fi

ENV_FILE=".env"
TEMPLATE_FILE=""

if [ -f .env.example ]; then
  TEMPLATE_FILE=".env.example"
elif [ -f examples/env/.env.example ]; then
  TEMPLATE_FILE="examples/env/.env.example"
fi

if [ ! -f "$ENV_FILE" ]; then
  if [ -n "$TEMPLATE_FILE" ]; then
    echo "ℹ️ .env não encontrado. Copiando ${TEMPLATE_FILE} -> .env"
    cp "$TEMPLATE_FILE" "$ENV_FILE"
  else
    echo "❌ .env não encontrado e nenhum template disponível para cópia automática."
    echo "   Crie .env na raiz com DATABASE_URL, REDIS_URL e JWT_SECRET."
    exit 1
  fi
fi

load_env_file() {
  local file="$1"
  [ -f "$file" ] || return 0

  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue

    line="${line#export }"
    if [[ ! "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      continue
    fi

    local key="${line%%=*}"
    local value="${line#*=}"

    value="${value#${value%%[![:space:]]*}}"
    value="${value%${value##*[![:space:]]}}"

    if [[ "$value" =~ ^\"(.*)\"$ ]]; then
      value="${BASH_REMATCH[1]}"
    elif [[ "$value" =~ ^\'(.*)\'$ ]]; then
      value="${BASH_REMATCH[1]}"
    fi

    export "$key=$value"
  done <"$file"
}

load_env_file "$TEMPLATE_FILE"
load_env_file "$ENV_FILE"

required_vars=(DATABASE_URL REDIS_URL JWT_SECRET)
missing_vars=()
for var_name in "${required_vars[@]}"; do
  if [ -z "${!var_name:-}" ]; then
    missing_vars+=("$var_name")
  fi
done

if [ "${#missing_vars[@]}" -gt 0 ]; then
  echo "❌ .env incompleto: faltam variáveis obrigatórias (${missing_vars[*]})."
  echo "   Arquivo analisado: ${ENV_FILE}"
  if [ -n "$TEMPLATE_FILE" ]; then
    echo "   Dica: compare com ${TEMPLATE_FILE} e preencha os campos ausentes."
  fi
  echo "   Exemplo mínimo:"
  echo "   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexogestao?schema=public"
  echo "   REDIS_URL=redis://localhost:6379"
  echo "   JWT_SECRET=change-this-secret-in-local"
  exit 1
fi

if [ "${#JWT_SECRET}" -lt 16 ]; then
  echo "⚠️ JWT_SECRET curto (${#JWT_SECRET} chars). Recomendado >= 32 chars, mesmo em ambiente local."
fi

if ! node -e "new URL(process.env.DATABASE_URL)" >/dev/null 2>&1; then
  echo "❌ DATABASE_URL inválida no .env: ${DATABASE_URL}"
  exit 1
fi

if ! node -e "new URL(process.env.REDIS_URL)" >/dev/null 2>&1; then
  echo "❌ REDIS_URL inválida no .env: ${REDIS_URL}"
  exit 1
fi

API_PORT="${API_PORT:-3000}"
WEB_PORT="${PORT:-3010}"
NEXO_API_URL="${NEXO_API_URL:-http://127.0.0.1:${API_PORT}}"

export DATABASE_URL REDIS_URL JWT_SECRET API_PORT REDIS_HOST REDIS_PORT NEXO_API_URL

if [ -z "${REDIS_HOST:-}" ] || [ -z "${REDIS_PORT:-}" ]; then
  REDIS_HOST="$(node -e "const u=new URL(process.env.REDIS_URL); process.stdout.write(u.hostname)")"
  REDIS_PORT="$(node -e "const u=new URL(process.env.REDIS_URL); process.stdout.write(u.port || '6379')")"
  export REDIS_HOST REDIS_PORT
fi

echo "ℹ️ Portas locais: API=${API_PORT} | WEB=${WEB_PORT}"
echo "ℹ️ NEXO_API_URL=${NEXO_API_URL}"

echo "🧱 Subindo Postgres e Redis via Docker Compose..."
"${COMPOSE_CMD[@]}" up -d postgres redis

get_container_id() {
  "${COMPOSE_CMD[@]}" ps -q "$1"
}

POSTGRES_CONTAINER="$(get_container_id postgres)"
REDIS_CONTAINER="$(get_container_id redis)"

if [ -z "$POSTGRES_CONTAINER" ] || [ -z "$REDIS_CONTAINER" ]; then
  echo "❌ Não foi possível localizar os containers de postgres/redis via docker compose ps."
  exit 1
fi

echo "⏳ Aguardando Postgres ficar healthy..."
until docker inspect --format='{{.State.Health.Status}}' "$POSTGRES_CONTAINER" 2>/dev/null | grep -q healthy; do
  sleep 2
done

echo "⏳ Aguardando Redis responder PING..."
until docker exec "$REDIS_CONTAINER" redis-cli ping 2>/dev/null | grep -q PONG; do
  sleep 2
done

echo "🗃️ Executando migrations..."
pnpm --filter ./apps/api run prisma:migrate:deploy

echo "🌱 Executando seed..."
pnpm --filter ./apps/api run prisma:seed

echo "🚀 Iniciando API + Web..."
trap 'kill 0' EXIT
API_PORT="$API_PORT" PORT="$API_PORT" pnpm --filter ./apps/api run dev &
PORT="$WEB_PORT" NEXO_API_URL="$NEXO_API_URL" pnpm --filter ./apps/web run dev
