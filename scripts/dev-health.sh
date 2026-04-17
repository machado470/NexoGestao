#!/usr/bin/env bash
set -euo pipefail

API_URL="${NEXO_API_URL:-http://127.0.0.1:3000}"
WEB_URL="${NEXO_WEB_URL:-http://127.0.0.1:3010}"

ok=0

check_http() {
  local name="$1"
  local url="$2"
  local code

  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 3 "$url" || true)"
  if [[ "$code" =~ ^(2|3) ]]; then
    echo "✅ $name OK ($url -> $code)"
  else
    echo "❌ $name indisponível ($url -> ${code:-sem resposta})"
    ok=1
  fi
}

check_http "API /health" "$API_URL/health"
check_http "WEB /" "$WEB_URL/"

if [ "$ok" -ne 0 ]; then
  echo
  echo "⚠️ Falha de healthcheck. Use: pnpm dev:logs"
  exit 1
fi

echo
echo "✅ Todos os healthchecks passaram."
