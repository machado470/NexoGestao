#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

CLEAN_MODE=0
SKIP_GENERATE="${DEV_FULL_SKIP_GENERATE:-0}"
SKIP_MIGRATE="${DEV_FULL_SKIP_MIGRATE:-0}"
SKIP_SEED="${DEV_FULL_SKIP_SEED:-0}"
for arg in "$@"; do
  if [ "$arg" = "--clean" ]; then
    CLEAN_MODE=1
  fi
  if [ "$arg" = "--skip-generate" ]; then
    SKIP_GENERATE=1
  fi
  if [ "$arg" = "--skip-migrate" ]; then
    SKIP_MIGRATE=1
  fi
  if [ "$arg" = "--skip-seed" ]; then
    SKIP_SEED=1
  fi
done
if [ "${DEV_FULL_CLEAN:-0}" = "1" ]; then
  CLEAN_MODE=1
fi

SCRIPT_START_TS="$(date +%s)"
phase_start_ts="$SCRIPT_START_TS"
phase_name="boot"

start_phase() {
  phase_name="${1:-phase}"
  phase_start_ts="$(date +%s)"
  echo "⏱️ [phase:start] ${phase_name}"
}

end_phase() {
  local ended_at elapsed
  ended_at="$(date +%s)"
  elapsed=$((ended_at - phase_start_ts))
  echo "✅ [phase:end] ${phase_name} (${elapsed}s)"
}

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
  local file="${1:-}"
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

if [ "$WEB_PORT" = "$API_PORT" ]; then
  if [ "$API_PORT" != "3010" ]; then
    echo "⚠️ PORT (${WEB_PORT}) conflita com API_PORT (${API_PORT}). Forçando Web/BFF para 3010."
    WEB_PORT="3010"
  else
    echo "⚠️ PORT (${WEB_PORT}) conflita com API_PORT (${API_PORT}). Forçando Web/BFF para 3011."
    WEB_PORT="3011"
  fi
fi

NEXO_API_URL="${NEXO_API_URL:-http://127.0.0.1:${API_PORT}}"

export DATABASE_URL REDIS_URL JWT_SECRET API_PORT REDIS_HOST REDIS_PORT NEXO_API_URL

if [ -z "${REDIS_HOST:-}" ] || [ -z "${REDIS_PORT:-}" ]; then
  REDIS_HOST="$(node -e "const u=new URL(process.env.REDIS_URL); process.stdout.write(u.hostname)")"
  REDIS_PORT="$(node -e "const u=new URL(process.env.REDIS_URL); process.stdout.write(u.port || '6379')")"
  export REDIS_HOST REDIS_PORT
fi

if [ "$CLEAN_MODE" = "1" ]; then
  echo "🧹 Modo clean ativado (flag --clean ou DEV_FULL_CLEAN=1)."
  docker rm -f nexogestao_postgres nexogestao_redis >/dev/null 2>&1 || true
fi

echo "ℹ️ Portas locais: API=${API_PORT} | WEB=${WEB_PORT}"
echo "ℹ️ NEXO_API_URL=${NEXO_API_URL}"

ensure_port_tooling() {
  if command -v lsof >/dev/null 2>&1; then
    return
  fi
  if command -v ss >/dev/null 2>&1; then
    return
  fi
  echo "⚠️ Nem lsof nem ss estão disponíveis; diagnóstico de processo externo pode ser limitado."
}

log_infra_ready() {
  local service="${1:-}"
  echo "[infra] ${service}_ready"
}

log_port_conflict_resolved() {
  local port="${1:-}"
  local detail="${2:-}"
  echo "[infra] port_conflict_resolved port=${port}${detail:+ ${detail}}"
}

container_on_port() {
  local port="${1:-}"
  local cid
  while IFS=$'\t' read -r cid _name; do
    [ -n "$cid" ] || continue
    if docker port "$cid" 2>/dev/null | grep -Eq "(^|:)${port}(\\s|$)"; then
      docker inspect --format '{{.Name}}' "$cid" 2>/dev/null | sed 's#^/##'
      return 0
    fi
  done < <(docker ps --format '{{.ID}}\t{{.Names}}')
  return 1
}

process_on_port() {
  local port="${1:-}"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | awk 'NR==2 {print $1 " (pid " $2 ")"; exit}'
    return 0
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "( sport = :$port )" 2>/dev/null | awk 'NR>1 && match($0, /users:\(\("([^\"]+)",pid=([0-9]+)/, m) {print m[1] " (pid " m[2] ")"; exit}'
    return 0
  fi

  return 0
}

lsof_dump_port() {
  local port="${1:-}"
  if command -v lsof >/dev/null 2>&1; then
    lsof -i :"$port" || true
  fi
}

port_in_use() {
  local port="${1:-}"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltn "( sport = :$port )" 2>/dev/null | awk 'NR>1 {found=1} END {exit found?0:1}'
    return $?
  fi

  (echo >/dev/tcp/127.0.0.1/"$port") >/dev/null 2>&1
}

is_nexo_container_name() {
  case "${1:-}" in
    nexogestao-postgres|nexogestao-redis|nexogestao_postgres|nexogestao_redis)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

kill_external_listener_if_needed() {
  local port="${1:-}"
  local purpose="${2:-infra}"

  lsof_dump_port "$port"

  if ! port_in_use "$port"; then
    return 0
  fi

  local owner
  owner="$(container_on_port "$port" || true)"
  if [ -n "$owner" ] && is_nexo_container_name "$owner"; then
    echo "ℹ️ ${purpose}: porta ${port} já vinculada ao container Nexo (${owner}) — reutilizando."
    return 0
  fi

  if ! command -v lsof >/dev/null 2>&1; then
    fail_if_external_port_block "$port" "$purpose"
    return 0
  fi

  local pids
  pids="$(lsof -t -i:"$port" 2>/dev/null | tr '\n' ' ' | xargs)"
  if [ -z "$pids" ]; then
    fail_if_external_port_block "$port" "$purpose"
    return 0
  fi

  echo "⚠️ ${purpose}: encerrando processo(s) externo(s) na porta ${port}: ${pids}"
  # shellcheck disable=SC2086
  kill -9 $pids || true
  sleep 1
  log_port_conflict_resolved "$port" "killed_pids=${pids}"
}

find_existing_nexo_container() {
  local service="${1:-}"
  local names=()
  if [ "$service" = "postgres" ]; then
    names=(nexogestao-postgres nexogestao_postgres)
  else
    names=(nexogestao-redis nexogestao_redis)
  fi

  local cname
  for cname in "${names[@]}"; do
    if docker inspect "$cname" >/dev/null 2>&1; then
      echo "$cname"
      return 0
    fi
  done

  return 1
}

container_running() {
  local cname="${1:-}"
  [ "$(docker inspect --format '{{.State.Running}}' "$cname" 2>/dev/null || true)" = "true" ]
}

wait_for_postgres() {
  local attempts=40
  echo "⏳ Validando Postgres na porta 5432..."
  until node -e "const n=require('net');const s=n.createConnection({host:'127.0.0.1',port:5432});s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),1000);" >/dev/null 2>&1; do
    attempts=$((attempts - 1))
    if [ "$attempts" -le 0 ]; then
      echo "❌ Postgres não respondeu na porta 5432 a tempo."
      exit 1
    fi
    sleep 2
  done
  echo "✅ Postgres respondendo na 5432."
}

wait_for_redis() {
  local attempts=40
  echo "⏳ Validando Redis na porta 6379..."
  until node -e 'const n=require("net");const s=n.createConnection({host:"127.0.0.1",port:6379});let d="";s.on("connect",()=>s.write("*1\r\n$4\r\nPING\r\n"));s.on("data",c=>{d+=c.toString();if(d.includes("+PONG")){s.end();process.exit(0)}});s.on("error",()=>process.exit(1));setTimeout(()=>process.exit(1),1200);' >/dev/null 2>&1; do
    attempts=$((attempts - 1))
    if [ "$attempts" -le 0 ]; then
      echo "❌ Redis não respondeu PING na porta 6379 a tempo."
      exit 1
    fi
    sleep 2
  done
  echo "✅ Redis respondendo na 6379."
}

fail_if_external_port_block() {
  local port="${1:-}"
  local purpose="${2:-}"

  if ! port_in_use "$port"; then
    return 0
  fi

  local cname
  cname="$(container_on_port "$port" || true)"
  if [ -n "$cname" ] && is_nexo_container_name "$cname"; then
    echo "ℹ️ ${purpose}: porta ${port} já ocupada por container Nexo (${cname}) — reutilizando."
    return 0
  fi

  local process_desc
  process_desc="$(process_on_port "$port" || true)"
  if [ -n "$cname" ]; then
    echo "❌ ${purpose}: porta ${port} ocupada por container externo (${cname})."
    echo "   Pare/remova o container e tente novamente."
  else
    echo "❌ ${purpose}: porta ${port} ocupada por processo externo${process_desc:+ (${process_desc})}."
    echo "   Libere a porta ${port} e execute pnpm dev:full novamente."
  fi
  exit 1
}

ensure_service_running() {
  local service="${1:-}"
  local port=""
  if [ "$service" = "postgres" ]; then
    port="5432"
  else
    port="6379"
  fi

  local existing_name
  existing_name="$(find_existing_nexo_container "$service" || true)"

  if [ "$CLEAN_MODE" = "1" ]; then
    if [ -n "$existing_name" ]; then
      echo "🧹 Removendo container legado/existente: ${existing_name}"
      docker rm -f "$existing_name" >/dev/null
    fi
    return 1
  fi

  if [ -n "$existing_name" ]; then
    if container_running "$existing_name"; then
      echo "ℹ️ ${service}: container já ativo (${existing_name}) — reutilizando."
      return 0
    fi

    echo "♻️ ${service}: container existente parado (${existing_name}) — iniciando."
    docker start "$existing_name" >/dev/null
    echo "✅ ${service}: container iniciado (${existing_name})."
    return 0
  fi

  if port_in_use "$port"; then
    local owner
    owner="$(container_on_port "$port" || true)"
    if [ -n "$owner" ] && is_nexo_container_name "$owner"; then
      echo "ℹ️ ${service}: porta ${port} já ligada ao container Nexo (${owner}) — reutilizando."
      if ! container_running "$owner"; then
        echo "♻️ ${service}: subindo container Nexo parado (${owner})."
        docker start "$owner" >/dev/null
      fi
      return 0
    fi

    fail_if_external_port_block "$port" "$service"
  fi

  echo "➕ ${service}: não encontrado. Será criado via Docker Compose."
  return 1
}

ensure_port_tooling
start_phase "infra:port-conflict-check"
kill_external_listener_if_needed "6379" "redis"
kill_external_listener_if_needed "5432" "postgres"
end_phase

services_to_up=()
start_phase "infra:containers"
for infra_service in postgres redis; do
  if ! ensure_service_running "$infra_service"; then
    services_to_up+=("$infra_service")
  fi
done

if [ "$CLEAN_MODE" = "1" ]; then
  echo "🧱 Subindo stack limpa de infra via Docker Compose (postgres + redis)..."
  "${COMPOSE_CMD[@]}" up -d --force-recreate postgres redis
elif [ "${#services_to_up[@]}" -gt 0 ]; then
  echo "🧱 Subindo infra faltante via Docker Compose: ${services_to_up[*]}"
  "${COMPOSE_CMD[@]}" up -d "${services_to_up[@]}"
else
  echo "✅ Infra já pronta. Nenhuma recriação necessária."
fi
end_phase

start_phase "infra:healthchecks"
wait_for_postgres
wait_for_redis
log_infra_ready "postgres"
log_infra_ready "redis"
end_phase

fail_if_external_port_block "3000" "API"
fail_if_external_port_block "3010" "Web"
if [ "$API_PORT" != "3000" ]; then
  fail_if_external_port_block "$API_PORT" "API"
fi
if [ "$WEB_PORT" != "3010" ]; then
  fail_if_external_port_block "$WEB_PORT" "Web"
fi

if [ "$SKIP_GENERATE" = "1" ]; then
  echo "⏭️ Prisma generate ignorado (DEV_FULL_SKIP_GENERATE=1 ou --skip-generate)."
else
  start_phase "prisma:generate"
  pnpm --filter ./apps/api run prisma:generate
  end_phase
fi

if [ "$SKIP_MIGRATE" = "1" ]; then
  echo "⏭️ Prisma migrate deploy ignorado (DEV_FULL_SKIP_MIGRATE=1 ou --skip-migrate)."
else
  start_phase "prisma:migrate:deploy"
  pnpm --filter ./apps/api run prisma:migrate:deploy
  end_phase
fi

if [ "$SKIP_SEED" = "1" ]; then
  echo "⏭️ Prisma seed ignorado (DEV_FULL_SKIP_SEED=1 ou --skip-seed)."
else
  start_phase "prisma:seed"
  pnpm --filter ./apps/api run prisma:seed
  end_phase
fi

wait_http_ready() {
  local label="${1:-service}"
  local url="${2:-}"
  local max_attempts="${3:-80}"
  local attempt=0
  local begin_ts
  begin_ts="$(date +%s)"

  while [ "$attempt" -lt "$max_attempts" ]; do
    if curl -sS -o /dev/null --max-time 2 "$url" >/dev/null 2>&1; then
      local elapsed
      elapsed=$(( $(date +%s) - begin_ts ))
      echo "✅ [probe] ${label} pronto em ${elapsed}s (${url})"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  echo "⚠️ [probe] ${label} não respondeu a tempo (${url})."
  return 1
}

wait_http_status() {
  local label="${1:-endpoint}"
  local url="${2:-}"
  local max_attempts="${3:-80}"
  local attempt=0
  local begin_ts
  begin_ts="$(date +%s)"

  while [ "$attempt" -lt "$max_attempts" ]; do
    local code
    code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 "$url" || true)"
    if [[ "$code" =~ ^[0-9]{3}$ ]] && [ "$code" != "000" ]; then
      local elapsed
      elapsed=$(( $(date +%s) - begin_ts ))
      echo "✅ [probe] ${label} respondeu em ${elapsed}s (HTTP ${code})"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  echo "⚠️ [probe] ${label} não respondeu a tempo (${url})."
  return 1
}

echo "🚀 Iniciando API + Web..."
API_PORT="$API_PORT" PORT="$API_PORT" pnpm --filter ./apps/api run dev &
API_PID=$!
PORT="$WEB_PORT" NEXO_API_URL="$NEXO_API_URL" pnpm --filter ./apps/web run dev &
WEB_PID=$!

cleanup() {
  kill "$API_PID" "$WEB_PID" >/dev/null 2>&1 || true
}
trap cleanup EXIT

start_phase "probe:startup-readiness"
wait_http_ready "api:health" "http://127.0.0.1:${API_PORT}/health" 120 || true
wait_http_ready "web:root" "http://127.0.0.1:${WEB_PORT}/" 120 || true
wait_http_status "web:session.me" "http://127.0.0.1:${WEB_PORT}/api/trpc/session.me?batch=1&input=%7B%220%22%3A%7B%7D%7D" 120 || true
wait_http_status "web:dashboard.status" "http://127.0.0.1:${WEB_PORT}/api/trpc/dashboard.status?batch=1&input=%7B%220%22%3A%7B%7D%7D" 120 || true
end_phase

TOTAL_ELAPSED=$(( $(date +%s) - SCRIPT_START_TS ))
echo "🏁 Boot concluído em ${TOTAL_ELAPSED}s"
echo "   API: http://127.0.0.1:${API_PORT}"
echo "   WEB: http://127.0.0.1:${WEB_PORT}"

wait "$WEB_PID"
