#!/usr/bin/env bash
set -euo pipefail

source scripts/token.sh >/dev/null

STATUS="${1:-}"

URL="$API_URL/service-orders"
if [ -n "$STATUS" ]; then
  URL="$URL?status=$STATUS"
fi

curl -s "$URL" -H "$AUTH" | jq
