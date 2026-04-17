#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ "$ROOT_DIR" == /mnt/* ]]; then
  echo "⚠️ Projeto executando em filesystem montado do Windows (${ROOT_DIR})."
  echo "   Em WSL isso pode degradar I/O, watch mode e tempo de bootstrap (especialmente Nest/Vite)."
  echo "   Recomendação: mover o repo para ~/NexoGestao dentro do filesystem Linux do WSL."
fi

CLEAN_MODE=0
SKIP_GENERATE="${DEV_FULL_SKIP_GENERATE:-0}"
SKIP_MIGRATE="${DEV_FULL_SKIP_MIGRATE:-0}"
SKIP_SEED="${DEV_FULL_SKIP_SEED:-0}"
AUTO_KILL_STALE_DEV_PROCESSES="${NEXO_KILL_STALE_DEV_PROCESSES:-0}"
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
if [ "$AUTO_KILL_STALE_DEV_PROCESSES" = "1" ]; then
  echo "ℹ️ Auto-limpeza de processos legados habilitada (NEXO_KILL_STALE_DEV_PROCESSES=1)."
else
  echo "ℹ️ Auto-limpeza de processos legados desabilitada. Para habilitar: NEXO_KILL_STALE_DEV_PROCESSES=1 pnpm dev:full"
fi

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

pid_command() {
  local pid="${1:-}"
  ps -p "$pid" -o args= 2>/dev/null | sed 's/^[[:space:]]*//'
}

pid_cwd() {
  local pid="${1:-}"
  readlink -f "/proc/${pid}/cwd" 2>/dev/null || true
}

listening_pids_on_port() {
  local port="${1:-}"
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  lsof -t -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u
}

is_pid_nexo_dev_process() {
  local pid="${1:-}"
  local cmd cwd root_real
  cmd="$(pid_command "$pid")"
  cwd="$(pid_cwd "$pid")"
  root_real="$(readlink -f "$ROOT_DIR" 2>/dev/null || echo "$ROOT_DIR")"

  [ -n "$cmd" ] || return 1

  local command_has_dev_runtime=1
  if [[ "$cmd" =~ (node|pnpm|vite|nest|tsx|turbo) ]]; then
    command_has_dev_runtime=0
  fi

  local command_has_nexo_markers=1
  if [[ "$cmd" == *"$ROOT_DIR"* ]] || [[ "$cmd" == *"$root_real"* ]] || [[ "$cmd" == *"apps/api"* ]] || [[ "$cmd" == *"apps/web"* ]] || [[ "$cmd" == *"dev:bff"* ]] || [[ "$cmd" == *"nest start"* ]] || [[ "$cmd" == *"pnpm --filter ./apps/api"* ]] || [[ "$cmd" == *"pnpm --filter ./apps/web"* ]]; then
    command_has_nexo_markers=0
  fi

  local cwd_is_project=1
  if [ -n "$cwd" ]; then
    if [[ "$cwd" == "$ROOT_DIR"* ]] || [[ "$cwd" == "$root_real"* ]]; then
      cwd_is_project=0
    fi
  fi

  if [ "$command_has_dev_runtime" -eq 0 ] && { [ "$command_has_nexo_markers" -eq 0 ] || [ "$cwd_is_project" -eq 0 ]; }; then
    return 0
  fi

  return 1
}

log_port_pid_summary() {
  local port="${1:-}"
  local pid="${2:-}"
  local classification="${3:-unknown}"
  local cmd
  cmd="$(pid_command "$pid")"
  if [ -z "$cmd" ]; then
    cmd="<comando indisponível>"
  fi
  echo "   - porta=${port} pid=${pid} class=${classification} cmd=${cmd}"
}

terminate_pids_gracefully() {
  local reason="${1:-stale}"
  shift
  local pids=("$@")
  if [ "${#pids[@]}" -eq 0 ]; then
    return 0
  fi

  echo "⚠️ ${reason}: enviando SIGTERM para PID(s): ${pids[*]}"
  kill "${pids[@]}" >/dev/null 2>&1 || true
  sleep 1

  local survivors=()
  local pid
  for pid in "${pids[@]}"; do
    if kill -0 "$pid" >/dev/null 2>&1; then
      survivors+=("$pid")
    fi
  done

  if [ "${#survivors[@]}" -gt 0 ]; then
    echo "⚠️ ${reason}: PID(s) ainda vivos após SIGTERM, enviando SIGKILL: ${survivors[*]}"
    kill -9 "${survivors[@]}" >/dev/null 2>&1 || true
    sleep 1
  fi
}

handle_dev_port_conflict() {
  local port="${1:-}"
  local purpose="${2:-Dev}"
  local enable_hint="NEXO_KILL_STALE_DEV_PROCESSES=1 pnpm dev:full"

  if ! port_in_use "$port"; then
    return 0
  fi

  local cname
  cname="$(container_on_port "$port" || true)"
  if [ -n "$cname" ]; then
    echo "❌ ${purpose}: porta ${port} ocupada por container externo (${cname})."
    echo "   Abortando por segurança. Pare/remova o container e tente novamente."
    exit 1
  fi

  if ! command -v lsof >/dev/null 2>&1; then
    fail_if_external_port_block "$port" "$purpose"
    return 0
  fi

  mapfile -t pids < <(listening_pids_on_port "$port")
  if [ "${#pids[@]}" -eq 0 ]; then
    fail_if_external_port_block "$port" "$purpose"
    return 0
  fi

  local nexo_pids=()
  local external_pids=()
  local pid
  for pid in "${pids[@]}"; do
    if is_pid_nexo_dev_process "$pid"; then
      nexo_pids+=("$pid")
      log_port_pid_summary "$port" "$pid" "nexo"
    else
      external_pids+=("$pid")
      log_port_pid_summary "$port" "$pid" "external"
    fi
  done

  if [ "${#external_pids[@]}" -gt 0 ]; then
    echo "❌ ${purpose}: processo externo detectado na porta ${port}; abortando por segurança."
    echo "   Dica: somente processos claramente do NexoGestao podem ser encerrados automaticamente."
    exit 1
  fi

  if [ "${#nexo_pids[@]}" -eq 0 ]; then
    fail_if_external_port_block "$port" "$purpose"
    return 0
  fi

  if [ "$AUTO_KILL_STALE_DEV_PROCESSES" != "1" ]; then
    echo "❌ ${purpose}: processo(s) legado(s) do Nexo detectado(s) na porta ${port}."
    echo "   Por segurança, o script não remove automaticamente sem opt-in."
    echo "   Use: ${enable_hint}"
    exit 1
  fi

  terminate_pids_gracefully "${purpose}: limpando processo(s) antigo(s) do Nexo na porta ${port}" "${nexo_pids[@]}"
  if port_in_use "$port"; then
    echo "❌ ${purpose}: falha ao liberar porta ${port} mesmo após tentativa de limpeza automática."
    exit 1
  fi
  echo "✅ ${purpose}: processo(s) antigo(s) do Nexo detectado(s) na porta ${port}, removido(s) automaticamente."
  log_port_conflict_resolved "$port" "killed_nexo_pids=${nexo_pids[*]}"
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

handle_dev_port_conflict "3000" "API"
handle_dev_port_conflict "3010" "Web/BFF"
if [ "$API_PORT" != "3000" ]; then
  handle_dev_port_conflict "$API_PORT" "API"
fi
if [ "$WEB_PORT" != "3010" ]; then
  handle_dev_port_conflict "$WEB_PORT" "Web/BFF"
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
  local process_pid="${4:-}"
  local attempt=0
  local begin_ts
  begin_ts="$(date +%s)"

  while [ "$attempt" -lt "$max_attempts" ]; do
    if [ -n "$process_pid" ] && ! kill -0 "$process_pid" >/dev/null 2>&1; then
      echo "❌ [probe] ${label} abortado: processo alvo encerrou antes da readiness."
      return 1
    fi
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
  local process_pid="${4:-}"
  local attempt=0
  local begin_ts
  begin_ts="$(date +%s)"

  while [ "$attempt" -lt "$max_attempts" ]; do
    if [ -n "$process_pid" ] && ! kill -0 "$process_pid" >/dev/null 2>&1; then
      echo "❌ [probe] ${label} abortado: processo alvo encerrou antes da readiness."
      return 1
    fi
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

wait_http_status_with_method() {
  local label="${1:-endpoint}"
  local url="${2:-}"
  local method="${3:-GET}"
  local body="${4:-}"
  local max_attempts="${5:-80}"
  local process_pid="${6:-}"
  local attempt=0
  local begin_ts
  begin_ts="$(date +%s)"

  while [ "$attempt" -lt "$max_attempts" ]; do
    if [ -n "$process_pid" ] && ! kill -0 "$process_pid" >/dev/null 2>&1; then
      echo "❌ [probe] ${label} abortado: processo alvo encerrou antes da readiness."
      return 1
    fi
    local code
    if [ -n "$body" ]; then
      code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 -X "$method" -H "Content-Type: application/json" -d "$body" "$url" || true)"
    else
      code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 2 -X "$method" "$url" || true)"
    fi
    if [[ "$code" =~ ^[0-9]{3}$ ]] && [ "$code" != "000" ]; then
      local elapsed
      elapsed=$(( $(date +%s) - begin_ts ))
      echo "✅ [probe] ${label} respondeu em ${elapsed}s (HTTP ${code})"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  echo "❌ [probe] ${label} não respondeu a tempo (${url})."
  return 1
}

wait_port_ready() {
  local label="${1:-service}"
  local host="${2:-127.0.0.1}"
  local port="${3:-3000}"
  local max_attempts="${4:-120}"
  local process_pid="${5:-}"
  local attempt=0
  local begin_ts
  begin_ts="$(date +%s)"

  while [ "$attempt" -lt "$max_attempts" ]; do
    if [ -n "$process_pid" ] && ! kill -0 "$process_pid" >/dev/null 2>&1; then
      echo "❌ [probe] ${label} abortado: processo alvo encerrou antes de abrir porta ${port}."
      return 1
    fi

    if node -e "const net=require('net'); const s=net.createConnection({host:'${host}',port:${port}}); s.on('connect',()=>{s.end();process.exit(0)}); s.on('error',()=>process.exit(1)); setTimeout(()=>process.exit(1),900);" >/dev/null 2>&1; then
      local elapsed
      elapsed=$(( $(date +%s) - begin_ts ))
      echo "✅ [probe] ${label} escutando em ${elapsed}s (${host}:${port})"
      return 0
    fi

    attempt=$((attempt + 1))
    sleep 1
  done

  echo "❌ [probe] ${label} não abriu porta a tempo (${host}:${port})."
  return 1
}

wait_process_started() {
  local label="${1:-processo}"
  local process_pid="${2:-}"
  local max_attempts="${3:-15}"
  local attempt=0
  local begin_ts
  begin_ts="$(date +%s)"

  while [ "$attempt" -lt "$max_attempts" ]; do
    if [ -n "$process_pid" ] && kill -0 "$process_pid" >/dev/null 2>&1; then
      local elapsed
      elapsed=$(( $(date +%s) - begin_ts ))
      echo "✅ [BOOT] ${label} iniciou em ${elapsed}s (pid=${process_pid})"
      return 0
    fi
    attempt=$((attempt + 1))
    sleep 1
  done

  echo "❌ [FATAL] ${label} não iniciou processo a tempo."
  return 1
}

show_recent_logs() {
  local title="${1:-logs}"
  local file="${2:-}"
  local lines="${3:-120}"

  [ -f "$file" ] || return 0
  echo "----- ${title} (últimas ${lines} linhas) -----"
  tail -n "$lines" "$file" || true
  echo "----- fim ${title} -----"
}

PRIMARY_ABORT_COMPONENT=""
PRIMARY_ABORT_REASON=""
PRIMARY_ABORT_DETAILS=""

register_abort_reason() {
  local component="${1:-unknown}"
  local reason="${2:-unknown}"
  local details="${3:-sem detalhes}"

  if [ -z "$PRIMARY_ABORT_COMPONENT" ]; then
    PRIMARY_ABORT_COMPONENT="$component"
    PRIMARY_ABORT_REASON="$reason"
    PRIMARY_ABORT_DETAILS="$details"
  fi
}

abort_with_logs() {
  local component="${1:-unknown}"
  local reason="${2:-failure}"
  local details="${3:-sem detalhes}"
  local log_file="${4:-}"

  register_abort_reason "$component" "$reason" "$details"
  echo "❌ [abort] component=${component} reason=${reason} details=${details}"
  if [ -n "$log_file" ]; then
    show_recent_logs "$component" "$log_file" 180
  fi
  exit 1
}

echo "🚀 Iniciando API + Web..."
API_LOG_FILE="$(mktemp -t nexogestao-api-dev-full.XXXX.log)"
WEB_LOG_FILE="$(mktemp -t nexogestao-web-dev-full.XXXX.log)"
echo "ℹ️ Logs de startup: api=${API_LOG_FILE} | web=${WEB_LOG_FILE}"

API_PID=""
WEB_PID=""

cleanup() {
  local exit_code="$?"
  if [ "$exit_code" -ne 0 ] && [ -n "$PRIMARY_ABORT_COMPONENT" ]; then
    echo "🧾 Causa primária registrada: component=${PRIMARY_ABORT_COMPONENT} reason=${PRIMARY_ABORT_REASON} details=${PRIMARY_ABORT_DETAILS}"
  fi

  if [ -n "${API_PID:-}" ] && kill -0 "$API_PID" >/dev/null 2>&1; then
    echo "🛑 Encerrando API (pid=${API_PID})"
    kill "$API_PID" >/dev/null 2>&1 || true
  fi

  if [ -n "${WEB_PID:-}" ] && kill -0 "$WEB_PID" >/dev/null 2>&1; then
    echo "🛑 Encerrando Web/BFF (pid=${WEB_PID})"
    kill "$WEB_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

API_PORT="$API_PORT" PORT="$API_PORT" pnpm --filter ./apps/api run dev > >(tee "$API_LOG_FILE") 2>&1 &
API_PID=$!
echo "✅ [BOOT] api spawn solicitado (pid=${API_PID})"

start_phase "probe:startup-readiness"
API_PORT_ATTEMPTS="${DEV_FULL_API_PORT_ATTEMPTS:-180}"
API_HEALTH_ATTEMPTS="${DEV_FULL_API_HEALTH_ATTEMPTS:-180}"
API_READINESS_ATTEMPTS="${DEV_FULL_API_READINESS_ATTEMPTS:-180}"
API_AUTH_ATTEMPTS="${DEV_FULL_API_AUTH_ATTEMPTS:-120}"
WEB_ROOT_ATTEMPTS="${DEV_FULL_WEB_ROOT_ATTEMPTS:-180}"
WEB_SESSION_ATTEMPTS="${DEV_FULL_WEB_SESSION_ATTEMPTS:-180}"
WEB_DASHBOARD_ATTEMPTS="${DEV_FULL_WEB_DASHBOARD_ATTEMPTS:-180}"
is_wsl_mnt=0
if [[ "$ROOT_DIR" == /mnt/* ]]; then
  is_wsl_mnt=1
fi
if [ "$is_wsl_mnt" = "1" ]; then
  API_PORT_ATTEMPTS="${DEV_FULL_API_PORT_ATTEMPTS:-360}"
  API_HEALTH_ATTEMPTS="${DEV_FULL_API_HEALTH_ATTEMPTS:-360}"
  API_READINESS_ATTEMPTS="${DEV_FULL_API_READINESS_ATTEMPTS:-360}"
  API_AUTH_ATTEMPTS="${DEV_FULL_API_AUTH_ATTEMPTS:-180}"
  WEB_ROOT_ATTEMPTS="${DEV_FULL_WEB_ROOT_ATTEMPTS:-360}"
  WEB_SESSION_ATTEMPTS="${DEV_FULL_WEB_SESSION_ATTEMPTS:-360}"
  WEB_DASHBOARD_ATTEMPTS="${DEV_FULL_WEB_DASHBOARD_ATTEMPTS:-360}"
  echo "⚠️ [WARN-LOCAL] [wsl-mnt] Timeouts de readiness ampliados para /mnt/* (I/O + watch mais lentos)."
fi

wait_process_started "api:process" "$API_PID" 20 || {
  abort_with_logs "api" "process_not_started" "Processo da API não permaneceu ativo após spawn" "$API_LOG_FILE"
}
wait_port_ready "api:port" "127.0.0.1" "$API_PORT" "$API_PORT_ATTEMPTS" "$API_PID" || {
  abort_with_logs "api" "port_probe_failed" "API não abriu porta ${API_PORT} durante bootstrap" "$API_LOG_FILE"
}
wait_http_ready "api:health" "http://127.0.0.1:${API_PORT}/health" "$API_HEALTH_ATTEMPTS" "$API_PID" || {
  abort_with_logs "api" "health_probe_failed" "API não respondeu /health durante bootstrap" "$API_LOG_FILE"
}
wait_http_ready "api:readiness" "http://127.0.0.1:${API_PORT}/health/readiness" "$API_READINESS_ATTEMPTS" "$API_PID" || {
  abort_with_logs "api" "readiness_probe_failed" "API não respondeu /health/readiness durante bootstrap" "$API_LOG_FILE"
}
wait_http_status_with_method "api:auth.login" "http://127.0.0.1:${API_PORT}/auth/login" "POST" '{"email":"","password":""}' "$API_AUTH_ATTEMPTS" "$API_PID" || {
  abort_with_logs "api" "auth_probe_failed" "API respondeu fora do esperado em /auth/login durante bootstrap" "$API_LOG_FILE"
}

PORT="$WEB_PORT" NEXO_API_URL="$NEXO_API_URL" pnpm --filter ./apps/web run dev > >(tee "$WEB_LOG_FILE") 2>&1 &
WEB_PID=$!
echo "✅ [BOOT] web spawn solicitado (pid=${WEB_PID})"
wait_process_started "web:process" "$WEB_PID" 20 || {
  abort_with_logs "web" "process_not_started" "Processo da Web/BFF não permaneceu ativo após spawn" "$WEB_LOG_FILE"
}

wait_http_ready "web:root" "http://127.0.0.1:${WEB_PORT}/" "$WEB_ROOT_ATTEMPTS" "$WEB_PID" || {
  abort_with_logs "web" "root_probe_failed" "Web/BFF não respondeu raiz na porta ${WEB_PORT}" "$WEB_LOG_FILE"
}
wait_http_status "web:session.me" "http://127.0.0.1:${WEB_PORT}/api/trpc/session.me?batch=1&input=%7B%220%22%3A%7B%7D%7D" "$WEB_SESSION_ATTEMPTS" "$WEB_PID" || {
  abort_with_logs "web" "session_probe_failed" "Web/BFF não respondeu session.me" "$WEB_LOG_FILE"
}
wait_http_status "web:dashboard.status" "http://127.0.0.1:${WEB_PORT}/api/trpc/dashboard.status?batch=1&input=%7B%220%22%3A%7B%7D%7D" "$WEB_DASHBOARD_ATTEMPTS" "$WEB_PID" || {
  abort_with_logs "web" "dashboard_probe_failed" "Web/BFF não respondeu dashboard.status" "$WEB_LOG_FILE"
}
end_phase

TOTAL_ELAPSED=$(( $(date +%s) - SCRIPT_START_TS ))
echo "🏁 [READY] Boot concluído em ${TOTAL_ELAPSED}s"
echo "   API: http://127.0.0.1:${API_PORT}"
echo "   WEB: http://127.0.0.1:${WEB_PORT}"
echo "🩺 Monitorando processos em foreground (api pid=${API_PID} | web pid=${WEB_PID})"

set +e
while true; do
  wait -n "$API_PID" "$WEB_PID"
  terminated_status=$?

  api_alive=0
  web_alive=0
  if kill -0 "$API_PID" >/dev/null 2>&1; then
    api_alive=1
  fi
  if kill -0 "$WEB_PID" >/dev/null 2>&1; then
    web_alive=1
  fi

  if [ "$api_alive" -eq 0 ]; then
    register_abort_reason "api" "process_exit" "API encerrou (pid=${API_PID}, status=${terminated_status})"
    echo "❌ [proc] api encerrou (pid=${API_PID}, status=${terminated_status})"
    show_recent_logs "api" "$API_LOG_FILE" 180
    exit "$terminated_status"
  fi

  if [ "$web_alive" -eq 0 ]; then
    register_abort_reason "web" "process_exit" "Web/BFF encerrou (pid=${WEB_PID}, status=${terminated_status})"
    echo "❌ [proc] web encerrou (pid=${WEB_PID}, status=${terminated_status})"
    show_recent_logs "web" "$WEB_LOG_FILE" 180
    exit "$terminated_status"
  fi
done
