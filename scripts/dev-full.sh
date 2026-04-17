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
  ss -ltn "( sport = :$port )" 2>/dev/null | awk 'NR>1 {found=1} END {exit found?0:1}'
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

kill_nexo_pids_on_port_if_opt_in() {
  local port="$1"
  [ "$ALLOW_KILL" = "1" ] || return 0
  command -v lsof >/dev/null 2>&1 || return 0

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
}

assert_port_available() {
  local port="$1"
  local label="$2"

  if ! port_in_use "$port"; then
    return 0
  fi

  local cname
  cname="$(container_on_port "$port" || true)"
  if [ -n "$cname" ] && [[ "$cname" != nexogestao_* ]] && [[ "$cname" != nexogestao-* ]]; then
    fail "$label: porta $port ocupada por container externo ($cname)."
  fi

  if [ "$label" = "API" ] || [ "$label" = "WEB" ]; then
    kill_nexo_pids_on_port_if_opt_in "$port"
    if ! port_in_use "$port"; then
      return 0
    fi
  fi

  fail "$label: porta $port ocupada."
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
if [ "$RESET_MODE" = "1" ]; then
  log "[BOOT] reset de infraestrutura (postgres/redis)..."
  docker compose down --volumes --remove-orphans >/dev/null 2>&1 || true
fi
log "[BOOT] subindo infraestrutura (postgres/redis)..."
docker compose up -d postgres redis >/dev/null

# 4) validar infra
wait_tcp 127.0.0.1 5432 60 || fail "Postgres não respondeu na porta 5432."
wait_tcp 127.0.0.1 6379 60 || fail "Redis não respondeu na porta 6379."

# 5) subir API
log "[BOOT] iniciando API..."
API_PORT="$API_PORT" PORT="$API_PORT" pnpm --filter ./apps/api run dev > "$API_LOG_FILE" 2>&1 &
API_PID=$!

# 6) esperar processo vivo + porta + /health
kill -0 "$API_PID" >/dev/null 2>&1 || fail "API encerrou no boot. Logs: $API_LOG_FILE"
wait_tcp 127.0.0.1 "$API_PORT" 120 || fail "API não abriu porta $API_PORT. Logs: $API_LOG_FILE"
log "[READY] API porta OK"
wait_http "http://127.0.0.1:${API_PORT}/health" 120 || fail "API não respondeu /health. Logs: $API_LOG_FILE"
log "[READY] API /health OK"

# 7) subir WEB
log "[BOOT] iniciando WEB..."
PORT="$WEB_PORT" NEXO_API_URL="$NEXO_API_URL" pnpm --filter ./apps/web run dev > "$WEB_LOG_FILE" 2>&1 &
WEB_PID=$!

# 8) validar root web
kill -0 "$WEB_PID" >/dev/null 2>&1 || fail "WEB encerrou no boot. Logs: $WEB_LOG_FILE"
wait_http "http://127.0.0.1:${WEB_PORT}/" 120 || fail "WEB não respondeu /. Logs: $WEB_LOG_FILE"
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
