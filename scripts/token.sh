#!/usr/bin/env bash

API_URL="${API_URL:-http://localhost:3000}"
NX_EMAIL="${NX_EMAIL:-}"
NX_PASSWORD="${NX_PASSWORD:-}"
NX_QUIET="${NX_QUIET:-0}"

is_sourced() {
  [[ "${BASH_SOURCE[0]}" != "${0}" ]]
}

# ✅ Se for source, não deixar "set -e" matar seu terminal
__NX_SAVED_OPTS=""
if is_sourced; then
  __NX_SAVED_OPTS="$(set +o)"  # snapshot das opções do shell atual
  set -u                      # só o -u é ok
else
  set -euo pipefail
fi

fail() {
  local code="${1:-1}"
  if is_sourced; then
    eval "$__NX_SAVED_OPTS" >/dev/null 2>&1 || true
    return "$code"
  else
    exit "$code"
  fi
}

need_bin() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ Faltando dependency: $1" >&2
    fail 1
  }
}

need_bin curl
need_bin node

check_api() {
  local code
  code="$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" || true)"
  if [[ -z "$code" || "$code" == "000" ]]; then
    echo "❌ API não respondeu em $API_URL" >&2
    fail 1
  fi
}

# ✅ Suporta:
# 1) { token: "..." }
# 2) { data: { token: "..." } }
# 3) { ok: true, data: { token: "..." } }
parse_token() {
  node -e '
    const fs=require("fs");
    const input=fs.readFileSync(0,"utf8");
    try {
      const j=JSON.parse(input);
      const token = j?.token || j?.data?.token || "";
      process.stdout.write(token || "");
    } catch {
      process.stdout.write("");
    }
  '
}

try_login() {
  local email="$1"
  local password="$2"

  local resp http
  http="$(curl -s -o /tmp/nx_login_body.json -w "%{http_code}" \
    -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" \
    || true)"

  resp="$(cat /tmp/nx_login_body.json 2>/dev/null || true)"

  local token
  token="$(printf "%s" "$resp" | parse_token)"

  if [[ -n "$token" && "$token" != "null" ]]; then
    echo "$token"
    return 0
  fi

  printf "%s" "$resp" > /tmp/nx_last_login_resp.json 2>/dev/null || true
  printf "%s" "$http" > /tmp/nx_last_login_http.txt 2>/dev/null || true
  return 1
}

check_api

TOKEN=""

# tenta credencial explícita
if [[ -n "$NX_EMAIL" && -n "$NX_PASSWORD" ]]; then
  if TOKEN="$(try_login "$NX_EMAIL" "$NX_PASSWORD")"; then
    :
  fi
fi

# fallback padrão
if [[ -z "$TOKEN" ]]; then
  candidates=(
    "admin@nexogestao.local|Admin@123456"
    "admin@demo.com|demo"
  )

  for pair in "${candidates[@]}"; do
    email="${pair%%|*}"
    pass="${pair#*|}"
    if TOKEN="$(try_login "$email" "$pass")"; then
      NX_EMAIL="$email"
      break
    fi
  done
fi

if [[ -z "$TOKEN" ]]; then
  echo "❌ Falha ao gerar token." >&2
  echo "HTTP: $(cat /tmp/nx_last_login_http.txt 2>/dev/null || echo "?")" >&2
  echo "Última resposta:" >&2
  cat /tmp/nx_last_login_resp.json 2>/dev/null || true
  fail 1
fi

export API_URL
export TOKEN
export AUTH="Authorization: Bearer $TOKEN"

if [[ "$NX_QUIET" != "1" ]]; then
  echo "API_URL=$API_URL"
  echo "NX_EMAIL=$NX_EMAIL"
  echo "TOKEN (25): ${TOKEN:0:25}..."
fi

# ✅ Se foi source, restaura as opções do shell atual
if is_sourced; then
  eval "$__NX_SAVED_OPTS" >/dev/null 2>&1 || true
fi
