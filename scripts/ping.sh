#!/usr/bin/env bash
set -euo pipefail
source scripts/token.sh >/dev/null
curl -s "$API_URL/health"
echo
curl -s "$API_URL/me" -H "$AUTH"
echo
