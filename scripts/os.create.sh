#!/usr/bin/env bash
set -euo pipefail

source scripts/token.sh >/dev/null

CUSTOMER_ID="${1:-}"
TITLE="${2:-OS criada via script}"
PRIORITY="${3:-2}"

if [ -z "$CUSTOMER_ID" ]; then
  echo "Uso: $0 <customerId> [title] [priority]" >&2
  exit 1
fi

RESP="$(
  curl -s -X POST "$API_URL/service-orders" \
    -H "$AUTH" \
    -H 'Content-Type: application/json' \
    -d "{\"customerId\":\"$CUSTOMER_ID\",\"title\":\"$TITLE\",\"priority\":$PRIORITY}"
)"

echo "$RESP" | jq .
