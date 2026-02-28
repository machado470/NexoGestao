#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:3000}"
EMAIL="${EMAIL:-admin@nexo.com}"
PASS="${PASS:-admin}"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[smoke] ERRO: comando '$1' não encontrado."
    exit 1
  }
}

need curl
need jq
need docker

echo "[smoke] API=$API"
echo "[smoke] login como $EMAIL"

TOKEN="$(
  curl -s -X POST "$API/auth/login" \
    -H 'Content-Type: application/json' \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASS\"}" \
  | jq -r '.data.token // .token // empty'
)"

if [[ -z "${TOKEN:-}" ]]; then
  echo "[smoke] ERRO: token vazio."
  exit 1
fi

echo "[smoke] TOKEN ok (len=$(printf %s "$TOKEN" | wc -c))"

ME="$(curl -s -H "Authorization: Bearer $TOKEN" "$API/me")"
echo "$ME" | jq .

ORG_ID="$(echo "$ME" | jq -r '.data.user.orgId // empty')"
PERSON_ID="$(echo "$ME" | jq -r '.data.user.personId // empty')"

if [[ -z "${ORG_ID:-}" || -z "${PERSON_ID:-}" ]]; then
  echo "[smoke] ERRO: /me inválido."
  exit 1
fi

echo
echo "[smoke] criando customer..."
CUSTOMER_ID="$(
  curl -s -X POST "$API/customers" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"name\":\"Cliente Smoke $(date +%H%M%S)\",\"phone\":\"47999990000\"}" \
  | jq -r '.data.id // .id // empty'
)"

echo "[smoke] CUSTOMER_ID=$CUSTOMER_ID"

echo
echo "[smoke] criando service-order..."
SO_ID="$(
  curl -s -X POST "$API/service-orders" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"title\":\"O.S. Smoke $(date +%H%M%S)\",\"customerId\":\"$CUSTOMER_ID\"}" \
  | jq -r '.data.id // .id // empty'
)"

echo "[smoke] SO_ID=$SO_ID"

echo
echo "[smoke] marcando DONE..."
curl -s -X PATCH "$API/service-orders/$SO_ID" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"status":"DONE","amountCents":15000,"dueDate":"2026-03-01T12:00:00.000Z"}' \
  | jq .

echo
echo "[smoke] buscando charge..."
CHARGE_ID="$(
  curl -s -H "Authorization: Bearer $TOKEN" \
    "$API/finance/charges?limit=20&orderBy=createdAt&direction=desc" \
  | jq -r '.data.items[0].id // empty'
)"

if [[ -z "${CHARGE_ID:-}" ]]; then
  CHARGE_ID="$(
    docker compose exec -T postgres psql -U postgres -d nexogestao -Atc "
      select id from \"Charge\" order by \"createdAt\" desc limit 1;
    " 2>/dev/null || true
  )"
fi

echo "[smoke] CHARGE_ID=$CHARGE_ID"

echo
echo "[smoke] conferindo charge..."
curl -s -H "Authorization: Bearer $TOKEN" "$API/finance/charges/$CHARGE_ID" | jq .

echo
echo "[smoke] pagando charge..."
PAY_RES="$(
  curl -s -X POST "$API/finance/charges/$CHARGE_ID/pay" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d '{"method":"CASH","amountCents":15000}'
)"
echo "$PAY_RES" | jq .

PAYMENT_ID="$(echo "$PAY_RES" | jq -r '.data.paymentId // empty')"
echo "[smoke] PAYMENT_ID=$PAYMENT_ID"

echo
echo "[smoke] finance/overview..."
curl -s -H "Authorization: Bearer $TOKEN" "$API/finance/overview" | jq .

echo
echo "[smoke] timeline (top 10)..."
curl -s -H "Authorization: Bearer $TOKEN" "$API/timeline" \
  | jq '(.data // .items // .data.items // .)[0:10]'

echo
echo "[smoke] audit (top 10)..."
curl -s -H "Authorization: Bearer $TOKEN" "$API/audit" \
  | jq '(.data.data // .data.items // .data // .)[0:10]'

echo
echo "========================================"
echo "[smoke] OK — ciclo completo executado"
echo "CUSTOMER_ID=$CUSTOMER_ID"
echo "SO_ID=$SO_ID"
echo "CHARGE_ID=$CHARGE_ID"
echo "PAYMENT_ID=$PAYMENT_ID"
echo "========================================"
