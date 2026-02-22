#!/usr/bin/env bash
set -euo pipefail

source scripts/token.sh >/dev/null

CUSTOMER_ID="${1:-}"
ASSIGNEE_ID="${2:-}"

if [ -z "$CUSTOMER_ID" ] || [ -z "$ASSIGNEE_ID" ]; then
  echo "Uso: $0 <customerId> <assigneePersonId>" >&2
  exit 1
fi

pick_id() {
  node -e '
    const fs = require("fs");
    const input = fs.readFileSync(0,"utf8").trim();
    try {
      const j = JSON.parse(input);
      const id = j?.data?.id || j?.id || "";
      process.stdout.write(id);
    } catch { process.stdout.write(""); }
  '
}

pretty() {
  node -e '
    const fs = require("fs");
    const input = fs.readFileSync(0,"utf8").trim();
    try {
      const j = JSON.parse(input);
      const o = j?.data ?? j;
      process.stdout.write(JSON.stringify(o, null, 2));
    } catch { process.stdout.write(input); }
  '
}

CREATE_RESP="$(
  curl -s -X POST "$API_URL/service-orders" \
    -H "$AUTH" \
    -H 'Content-Type: application/json' \
    -d "{\"customerId\":\"$CUSTOMER_ID\",\"title\":\"OS demo flow\",\"priority\":2}"
)"

SO_ID="$(printf "%s" "$CREATE_RESP" | pick_id)"

if [ -z "$SO_ID" ] || [ "$SO_ID" = "null" ]; then
  echo "❌ Falha ao criar OS. Resposta:" >&2
  printf "%s" "$CREATE_RESP" | pretty
  echo
  exit 1
fi

echo "SO_ID=$SO_ID"

PATCH1="$(
  curl -s -X PATCH "$API_URL/service-orders/$SO_ID" \
    -H "$AUTH" \
    -H 'Content-Type: application/json' \
    -d "{\"assignedToPersonId\":\"$ASSIGNEE_ID\"}"
)"
printf "%s" "$PATCH1" | pretty
echo

PATCH2="$(
  curl -s -X PATCH "$API_URL/service-orders/$SO_ID" \
    -H "$AUTH" \
    -H 'Content-Type: application/json' \
    -d '{"status":"IN_PROGRESS"}'
)"
printf "%s" "$PATCH2" | pretty
echo

PATCH3="$(
  curl -s -X PATCH "$API_URL/service-orders/$SO_ID" \
    -H "$AUTH" \
    -H 'Content-Type: application/json' \
    -d '{"status":"DONE"}'
)"
printf "%s" "$PATCH3" | pretty
echo
