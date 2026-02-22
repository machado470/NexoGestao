#!/usr/bin/env bash
set -euo pipefail

source scripts/token.sh >/dev/null

MODE="${1:-}"

extract_first_id() {
  node -e '
    const fs = require("fs");
    const input = fs.readFileSync(0,"utf8").trim();
    let j;
    try { j = JSON.parse(input); } catch { process.exit(2); }
    const arr = Array.isArray(j) ? j : (j && j.data) ? j.data : [];
    const id = (arr && arr[0] && arr[0].id) ? arr[0].id : "";
    process.stdout.write(id);
  '
}

get_first_id() {
  local url="$1"
  local label="$2"

  local resp id
  resp="$(curl -s "$url" -H "$AUTH")"
  id="$(printf "%s" "$resp" | extract_first_id || true)"

  if [ -z "$id" ] || [ "$id" = "null" ]; then
    echo "❌ Nenhum $label encontrado em $url" >&2
    echo "$resp" > /tmp/nx_last_ids_resp.json
    exit 1
  fi

  echo "$id"
}

case "$MODE" in
  customer)  get_first_id "$API_URL/customers" "customer" ;;
  assignee)  get_first_id "$API_URL/people" "colaborador" ;;
  *)
    echo "Uso: $0 [customer|assignee]" >&2
    exit 1
    ;;
esac
