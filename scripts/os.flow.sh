#!/usr/bin/env bash
set -euo pipefail

source scripts/token.sh >/dev/null

CUSTOMER_ID="${1:-}"
ASSIGNEE_ID="${2:-}"

if [ -z "$CUSTOMER_ID" ] || [ -z "$ASSIGNEE_ID" ]; then
  echo "Uso: $0 <customerId> <assigneePersonId>" >&2
  exit 1
fi

SO_ID=$(
  curl -s -X POST "$API_URL/service-orders" \
    -H "$AUTH" \
    -H 'Content-Type: application/json' \
    -d "{\"customerId\":\"$CUSTOMER_ID\",\"title\":\"OS demo flow\",\"priority\":2}" \
  | jq -r '.data.id'
)

echo "SO_ID=$SO_ID"

curl -s -X PATCH "$API_URL/service-orders/$SO_ID" \
  -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d "{\"assignedToPersonId\":\"$ASSIGNEE_ID\"}" | jq '.data | {id,status,assignedToPersonId}'

curl -s -X PATCH "$API_URL/service-orders/$SO_ID" \
  -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"status":"IN_PROGRESS"}' | jq '.data | {id,status,startedAt,finishedAt}'

curl -s -X PATCH "$API_URL/service-orders/$SO_ID" \
  -H "$AUTH" \
  -H 'Content-Type: application/json' \
  -d '{"status":"DONE"}' | jq '.data | {id,status,startedAt,finishedAt}'
