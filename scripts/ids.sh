#!/usr/bin/env bash
set -euo pipefail

source scripts/token.sh >/dev/null

MODE="${1:-}"

case "$MODE" in
  customer)
    curl -s "$API_URL/customers" -H "$AUTH" | jq -r '.data[0].id'
    ;;
  assignee)
    curl -s "$API_URL/people" -H "$AUTH" | jq -r '.data[0].id'
    ;;
  *)
    echo "Uso: $0 [customer|assignee]" >&2
    exit 1
    ;;
esac
