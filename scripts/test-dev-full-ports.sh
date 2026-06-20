#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

NEXO_PORT_TO_TEST="${NEXO_TEST_PORT:-33080}"
EXTERNAL_PORT_TO_TEST="${NEXO_TEST_EXTERNAL_PORT:-33081}"
NEXO_LOG_FILE="$(mktemp -t nexogestao-dev-full-nexo-port-test.XXXX.log)"
EXTERNAL_LOG_FILE="$(mktemp -t nexogestao-dev-full-external-port-test.XXXX.log)"
NEXO_PID=""
EXTERNAL_PID=""
EXTERNAL_DIR="$(mktemp -d -t nexogestao-external-port.XXXX)"

cleanup() {
  for pid in "$NEXO_PID" "$EXTERNAL_PID"; do
    if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
  rm -f "$NEXO_LOG_FILE" "$EXTERNAL_LOG_FILE"
  rm -rf "$EXTERNAL_DIR"
}
trap cleanup EXIT

start_server() {
  local port="$1"
  local log_file="$2"
  PORT="$port" node -e "require('http').createServer((_req,res)=>res.end('port test')).listen(Number(process.env.PORT),'127.0.0.1')" >"$log_file" 2>&1 &
  echo "$!"
}

NEXO_PID="$(start_server "$NEXO_PORT_TO_TEST" "$NEXO_LOG_FILE")"
sleep 1

if ! kill -0 "$NEXO_PID" >/dev/null 2>&1; then
  echo "[ERROR] processo node do NexoGestão não iniciou. Log: $(cat "$NEXO_LOG_FILE")" >&2
  exit 1
fi

# shellcheck source=./dev-full.sh
source "$ROOT_DIR/scripts/dev-full.sh"

ALLOW_KILL=1
kill_nexo_pids_on_port_if_opt_in "$NEXO_PORT_TO_TEST"

sleep 1
if port_in_use "$NEXO_PORT_TO_TEST"; then
  echo "[ERROR] processo antigo do NexoGestão ainda escuta na porta $NEXO_PORT_TO_TEST" >&2
  exit 1
fi

echo "[OK] processo antigo do NexoGestão na porta $NEXO_PORT_TO_TEST foi encerrado com segurança"

(
  cd "$EXTERNAL_DIR"
  PORT="$EXTERNAL_PORT_TO_TEST" node -e "require('http').createServer((_req,res)=>res.end('external app')).listen(Number(process.env.PORT),'127.0.0.1')" >"$EXTERNAL_LOG_FILE" 2>&1 &
  echo "$!" > pid
)
EXTERNAL_PID="$(cat "$EXTERNAL_DIR/pid")"
sleep 1

if ! kill -0 "$EXTERNAL_PID" >/dev/null 2>&1; then
  echo "[ERROR] processo externo de teste não iniciou. Log: $(cat "$EXTERNAL_LOG_FILE")" >&2
  exit 1
fi

kill_nexo_pids_on_port_if_opt_in "$EXTERNAL_PORT_TO_TEST"

if ! kill -0 "$EXTERNAL_PID" >/dev/null 2>&1 || ! port_in_use "$EXTERNAL_PORT_TO_TEST"; then
  echo "[ERROR] processo externo na porta $EXTERNAL_PORT_TO_TEST foi encerrado indevidamente" >&2
  exit 1
fi

echo "[OK] processo externo na porta $EXTERNAL_PORT_TO_TEST foi preservado"
