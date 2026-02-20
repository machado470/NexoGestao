#!/usr/bin/env bash
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"

TOKEN=$(
  curl -s -X POST "$API_URL/auth/login" \
    -H 'Content-Type: application/json' \
    -d '{"email":"admin@nexogestao.local","password":"Admin@123456"}' \
  | jq -r '.data.token'
)

if [ -z "${TOKEN:-}" ] || [ "$TOKEN" = "null" ]; then
  echo "Falha ao gerar token (veja resposta do /auth/login)." >&2
  exit 1
fi

export API_URL
export TOKEN
export AUTH="Authorization: Bearer $TOKEN"

echo "API_URL=$API_URL"
echo "TOKEN exportado (primeiros 25 chars): ${TOKEN:0:25}..."
