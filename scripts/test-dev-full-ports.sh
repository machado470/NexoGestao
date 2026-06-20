#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

PORT_TO_TEST="${NEXO_TEST_PORT:-33080}"
LOG_FILE="$(mktemp -t nexogestao-dev-full-port-test.XXXX.log)"
PID=""

cleanup() {
  if [ -n "$PID" ] && kill -0 "$PID" >/dev/null 2>&1; then
    kill "$PID" >/dev/null 2>&1 || true
  fi
  rm -f "$LOG_FILE"
}
trap cleanup EXIT

PORT="$PORT_TO_TEST" node -e "require('http').createServer((_req,res)=>res.end('old nexo dev')).listen(Number(process.env.PORT),'127.0.0.1')" >"$LOG_FILE" 2>&1 &
PID=$!
sleep 1

if ! kill -0 "$PID" >/dev/null 2>&1; then
  echo "[ERROR] processo node de teste não iniciou. Log: $(cat "$LOG_FILE")" >&2
  exit 1
fi

# shellcheck source=./dev-full.sh
source "$ROOT_DIR/scripts/dev-full.sh"

ALLOW_KILL=1
kill_nexo_pids_on_port_if_opt_in "$PORT_TO_TEST"

if kill -0 "$PID" >/dev/null 2>&1; then
  echo "[ERROR] processo antigo do NexoGestão na porta $PORT_TO_TEST não foi encerrado" >&2
  exit 1
fi

echo "[OK] processo antigo do NexoGestão na porta $PORT_TO_TEST foi encerrado com segurança"
