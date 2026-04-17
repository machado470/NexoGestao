#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

API_PORT="${API_PORT:-3000}"
WEB_PORT="${PORT:-3010}"
NEXO_API_URL="${NEXO_API_URL:-http://localhost:${API_PORT}}"
ALLOW_KILL="${NEXO_KILL_STALE_DEV_PROCESSES:-0}"
RESET_MODE="${NEXO_DEV_RESET:-0}"

API_LOG_FILE="$(mktemp -t nexogestao-api.XXXX.log)"
WEB_LOG_FILE="$(mktemp -t nexogestao-web.XXXX.log)"
API_PID=""
WEB_PID=""

log() { echo "$1"; }
fail() { echo "[ERROR] $1"; exit 1; }

ensure_env_file() {
  if [ -f .env ]; then
    return 0
  fi

  if [ ! -f .env.example ]; then
    fail ".env ausente e .env.example não encontrado para bootstrap automático."
  fi

  cp .env.example .env
  log "[BOOT] .env ausente; criado automaticamente a partir de .env.example"
}

validate_required_env() {
  local required=(DATABASE_URL REDIS_URL API_PORT PORT)
  local missing=()

  for key in "${required[@]}"; do
    local value="${!key:-}"
    if [ -z "${value// }" ]; then
      missing+=("$key")
    fi
  done

  if [ "${#missing[@]}" -gt 0 ]; then
    fail "Variáveis obrigatórias ausentes no ambiente/.env: ${missing[*]}"
  fi
}

cleanup() {
  local code="$?"
  if [ -n "$API_PID" ] && kill -0 "$API_PID" >/dev/null 2>&1; then
    kill "$API_PID" >/dev/null 2>&1 || true
  fi
  if [ -n "$WEB_PID" ] && kill -0 "$WEB_PID" >/dev/null 2>&1; then
    kill "$WEB_PID" >/dev/null 2>&1 || true
  fi
  exit "$code"
}
trap cleanup EXIT

port_in_use() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi

  if command -v ss >/dev/null 2>&1; then
    ss -ltn 2>/dev/null | awk -v p=":$port" 'NR>1 && $4 ~ p {found=1} END {exit found?0:1}'
    return $?
  fi

  if command -v node >/dev/null 2>&1; then
    node -e "const net=require('net');const s=net.createServer();s.once('error',()=>process.exit(0));s.once('listening',()=>s.close(()=>process.exit(1)));s.listen($port,'127.0.0.1');" >/dev/null 2>&1
    return $?
  fi

  return 1
}

port_owner() {
  local port="$1"

  if command -v lsof >/dev/null 2>&1; then
    local lsof_out
    lsof_out="$(lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | tail -n +2 | head -n 1 || true)"
    if [ -n "$lsof_out" ]; then
      echo "$lsof_out"
      return 0
    fi
  fi

  if command -v ss >/dev/null 2>&1; then
    local ss_out
    ss_out="$(ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p {print; exit}' || true)"
    if [ -n "$ss_out" ]; then
      echo "$ss_out"
      return 0
    fi
  fi

  if docker info >/dev/null 2>&1; then
    local d_out
    d_out="$(docker ps --format '{{.Names}}\t{{.Ports}}' | awk -v p=":""$port" '$0 ~ p {print; exit}' || true)"
    if [ -n "$d_out" ]; then
      echo "docker $d_out"
      return 0
    fi
  fi

  return 1
}

container_on_port() {
  local port="$1"
  local cid
  while IFS=$'\t' read -r cid _; do
    [ -n "$cid" ] || continue
    if docker port "$cid" 2>/dev/null | grep -Eq "(^|:)${port}(\\s|$)"; then
      docker inspect --format '{{.Name}}' "$cid" 2>/dev/null | sed 's#^/##'
      return 0
    fi
  done < <(docker ps --format '{{.ID}}\t{{.Names}}')
  return 1
}

is_nexo_pid() {
  local pid="$1"
  local cmd
  cmd="$(ps -p "$pid" -o args= 2>/dev/null || true)"
  [[ "$cmd" == *"$ROOT_DIR"* ]] || [[ "$cmd" == *"apps/api"* ]] || [[ "$cmd" == *"apps/web"* ]]
}

kill_nexo_node_fallback() {
  local label="$1"
  local killed_any=0

  while read -r pid _; do
    [ -n "$pid" ] || continue
    if is_nexo_pid "$pid"; then
      kill "$pid" >/dev/null 2>&1 || true
      sleep 1
      kill -9 "$pid" >/dev/null 2>&1 || true
      killed_any=1
    fi
  done < <(ps -eo pid=,args= | awk '/[n]ode/ {print $1" "$0}')

  if [ "$killed_any" = "1" ]; then
    log "[BOOT] limpeza fallback aplicada: processos node do projeto finalizados ($label)."
  fi
}

kill_nexo_pids_on_port_if_opt_in() {
  local port="$1"
  [ "$ALLOW_KILL" = "1" ] || return 0

  if command -v lsof >/dev/null 2>&1; then
    local killed_any=0
    while read -r pid; do
      [ -n "$pid" ] || continue
      if is_nexo_pid "$pid"; then
        kill "$pid" >/dev/null 2>&1 || true
        sleep 1
        kill -9 "$pid" >/dev/null 2>&1 || true
        killed_any=1
      fi
    done < <(lsof -t -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null | sort -u)

    if [ "$killed_any" = "1" ]; then
      log "[BOOT] limpeza opt-in aplicada na porta $port"
    fi

    return 0
  fi

  kill_nexo_node_fallback "porta $port"
}

assert_port_available() {
  local port="$1"
  local label="$2"

  if ! port_in_use "$port"; then
    return 0
  fi

  local owner=""
  owner="$(port_owner "$port" || true)"

  if docker info >/dev/null 2>&1; then
    local cname
    cname="$(container_on_port "$port" || true)"
    if [ -n "$cname" ] && [[ "$cname" != nexogestao_* ]] && [[ "$cname" != nexogestao-* ]]; then
      fail "$label: porta $port ocupada por container externo ($cname). ${owner:+Processo: $owner}"
    fi

    if [ "$label" = "Postgres" ] || [ "$label" = "Redis" ]; then
      if [ -n "$cname" ] && ([[ "$cname" == nexogestao_* ]] || [[ "$cname" == nexogestao-* ]]); then
        log "[BOOT] $label já está publicado na porta $port via container $cname; seguindo bootstrap."
        return 0
      fi
    fi
  fi

  if [ "$label" = "API" ] || [ "$label" = "WEB" ]; then
    kill_nexo_pids_on_port_if_opt_in "$port"
    if ! port_in_use "$port"; then
      return 0
    fi
  fi

  fail "$label: porta $port ocupada. ${owner:+Processo: $owner}. Dica: rode 'pnpm dev:ports' para detalhes."
}

wait_tcp() {
  local host="$1"
  local port="$2"
  local tries="${3:-60}"
  local i=0
  while [ "$i" -lt "$tries" ]; do
    if node -e "const net=require('net');const s=net.createConnection({host:'$host',port:$port});s.on('connect',()=>{s.end();process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),700);" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  return 1
}

wait_http() {
  local url="$1"
  local tries="${2:-90}"
  local i=0
  while [ "$i" -lt "$tries" ]; do
    if curl -sS -o /dev/null --max-time 2 "$url" >/dev/null 2>&1; then
      return 0
    fi
    i=$((i + 1))
    sleep 1
  done
  return 1
}

# 1) checar portas
ensure_env_file
set -a
source ./.env
set +a
validate_required_env

assert_port_available 5432 "Postgres"
assert_port_available 6379 "Redis"
assert_port_available "$API_PORT" "API"
assert_port_available "$WEB_PORT" "WEB"

# 2) (opcional) limpar processos do próprio Nexo
if [ "$ALLOW_KILL" = "1" ]; then
  kill_nexo_pids_on_port_if_opt_in "$API_PORT"
  kill_nexo_pids_on_port_if_opt_in "$WEB_PORT"
fi

# 3) subir containers
if ! docker info >/dev/null 2>&1; then
  fail "Docker indisponível no ambiente atual. No WSL, abra o Docker Desktop e habilite a integração da distro em Settings > Resources > WSL Integration; depois valide com 'docker --version' e 'docker info'."
fi

if [ "$RESET_MODE" = "1" ]; then
  log "[BOOT] reset de infraestrutura (postgres/redis)..."
  docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
fi

log "[BOOT] subindo infraestrutura (postgres/redis) via docker-compose.yml..."
docker compose -f docker-compose.yml up -d postgres redis >/dev/null

# 4) validar infra
wait_tcp 127.0.0.1 5432 60 || fail "Banco PostgreSQL não disponível na porta 5432. Verifique: pnpm dev:logs"
wait_tcp 127.0.0.1 6379 60 || fail "Redis não disponível na porta 6379. Verifique: pnpm dev:logs"

# 5) subir API
log "[BOOT] iniciando API..."
API_PORT="$API_PORT" PORT="$API_PORT" pnpm --filter ./apps/api run dev > "$API_LOG_FILE" 2>&1 &
API_PID=$!

# 6) esperar processo vivo + porta + /health
kill -0 "$API_PID" >/dev/null 2>&1 || fail "API falhou no boot. Veja logs: $API_LOG_FILE"
wait_tcp 127.0.0.1 "$API_PORT" 120 || fail "API não abriu porta $API_PORT. Veja logs: $API_LOG_FILE"
log "[READY] API porta OK"
wait_http "http://127.0.0.1:${API_PORT}/health" 120 || fail "API falhou no /health. Veja logs: $API_LOG_FILE"
log "[READY] API /health OK"

# 7) subir WEB
log "[BOOT] iniciando WEB..."
PORT="$WEB_PORT" NEXO_API_URL="$NEXO_API_URL" pnpm --filter ./apps/web run dev > "$WEB_LOG_FILE" 2>&1 &
WEB_PID=$!

# 8) validar root web
kill -0 "$WEB_PID" >/dev/null 2>&1 || fail "WEB falhou no boot. Veja logs: $WEB_LOG_FILE"
wait_http "http://127.0.0.1:${WEB_PORT}/" 120 || fail "WEB não respondeu /. Veja logs: $WEB_LOG_FILE"
log "[READY] WEB OK"

# Optional integrations (non-blocking)
[ -n "${STRIPE_SECRET_KEY:-}" ] || log "[OPTIONAL] Stripe não configurado"
[ -n "${GOOGLE_CLIENT_ID:-}" ] || log "[OPTIONAL] Google OAuth não configurado"
[ -n "${WHATSAPP_PROVIDER:-}${ZAPI_INSTANCE_ID:-}" ] || log "[OPTIONAL] WhatsApp não configurado"
[ -n "${SENTRY_DSN:-}" ] || log "[OPTIONAL] Sentry não configurado"

# 9) status geral
log ""
log "[SUCCESS] ambiente pronto:"
log "- API: http://localhost:${API_PORT}"
log "- WEB: http://localhost:${WEB_PORT}"
log ""
log "[BOOT] logs: API=${API_LOG_FILE} WEB=${WEB_LOG_FILE}"

set +e
while true; do
  wait -n "$API_PID" "$WEB_PID"
  status=$?
  if ! kill -0 "$API_PID" >/dev/null 2>&1; then
    fail "API encerrou (status=$status). Logs: $API_LOG_FILE"
  fi
  if ! kill -0 "$WEB_PID" >/dev/null 2>&1; then
    fail "WEB encerrou (status=$status). Logs: $WEB_LOG_FILE"
  fi
done
