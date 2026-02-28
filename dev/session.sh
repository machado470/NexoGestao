#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:3000}"
EMAIL="${EMAIL:-admin@nexo.com}"
PASS="${PASS:-admin}"

echo "[session] login em $API como $EMAIL"

export TOKEN="$(
  curl -s -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  | jq -r '.data.token // .token // empty'
)"

if [[ -z "${TOKEN:-}" ]]; then
  echo "[session] ERRO: token vazio. Veja resposta do /auth/login."
  exit 1
fi

echo "[session] TOKEN ok (len=$(printf %s "$TOKEN" | wc -c))"

# valida sessão
curl -s -H "Authorization: Bearer $TOKEN" "$API/me" | jq .

# Helpers (últimos IDs do banco)
export SO_ID="$(
  docker compose exec -T postgres psql -U postgres -d nexogestao -Atc "
    select id from \"ServiceOrder\" order by \"createdAt\" desc limit 1;
  " 2>/dev/null || true
)"

export CHARGE_ID="$(
  docker compose exec -T postgres psql -U postgres -d nexogestao -Atc "
    select id from \"Charge\" order by \"createdAt\" desc limit 1;
  " 2>/dev/null || true
)"

echo "[session] SO_ID=[${SO_ID:-}]"
echo "[session] CHARGE_ID=[${CHARGE_ID:-}]"

echo
echo "Use assim:"
echo "  curl -H \"Authorization: Bearer \$TOKEN\" $API/me | jq"
