#!/usr/bin/env bash
set -euo pipefail

LIMIT="${1:-12}"
SO_FILTER="${2:-}"      # opcional: serviceOrderId para filtrar
MODE="${3:-}"           # opcional: --json

json_only=0
if [[ "$MODE" == "--json" ]]; then
  json_only=1
fi

# token silencioso (mas erros continuam aparecendo)
NX_QUIET=1 source scripts/token.sh >/dev/null

die() { echo "❌ $*" >&2; exit 1; }

# valida token rápido
ME_CODE="$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/me" -H "$AUTH" || true)"
if [[ "$ME_CODE" != "200" ]]; then
  die "Token inválido/expirado (GET /me => $ME_CODE). Rode: source scripts/token.sh"
fi

title() {
  [[ "$json_only" -eq 1 ]] && return 0
  echo "=== $* ==="
}

# TIMELINE
title "TIMELINE (top $LIMIT) ${SO_FILTER:+| filter=$SO_FILTER}"
curl -s "$API_URL/timeline" -H "$AUTH" \
| node -e '
  const fs = require("fs");
  const limit = Number(process.argv[1] || 12);
  const so = process.argv[2] || "";
  const jsonOnly = process.argv[3] === "1";

  const j = JSON.parse(fs.readFileSync(0,"utf8"));
  const a = j.data || [];

  const filtered = so ? a.filter(e => (e.metadata && e.metadata.serviceOrderId) === so) : a;

  const out = filtered.slice(0, limit).map(e => ({
    action: e.action,
    createdAt: e.createdAt,
    serviceOrderId: e.metadata?.serviceOrderId || null,
    personId: e.personId || null
  }));

  process.stdout.write(jsonOnly ? JSON.stringify(out) : JSON.stringify(out, null, 2));
' "$LIMIT" "$SO_FILTER" "$json_only"
echo; echo

# AUDIT
title "AUDIT (top $LIMIT) ${SO_FILTER:+| filter=$SO_FILTER}"
curl -s "$API_URL/audit" -H "$AUTH" \
| node -e '
  const fs = require("fs");
  const limit = Number(process.argv[1] || 12);
  const so = process.argv[2] || "";
  const jsonOnly = process.argv[3] === "1";

  const j = JSON.parse(fs.readFileSync(0,"utf8"));
  const a = (j.data && j.data.data) ? j.data.data : (j.data || []);

  const filtered = so ? a.filter(e => e.entityId === so) : a;

  const out = filtered.slice(0, limit).map(e => ({
    action: e.action,
    entityType: e.entityType || null,
    entityId: e.entityId || null,
    before: e.metadata?.before || null,
    patch: e.metadata?.patch || null,
    after: e.metadata?.after || null,
    at: e.createdAt
  }));

  process.stdout.write(jsonOnly ? JSON.stringify(out) : JSON.stringify(out, null, 2));
' "$LIMIT" "$SO_FILTER" "$json_only"
echo; echo

# PENDING
title "PENDING (me)"
curl -s "$API_URL/pending/me" -H "$AUTH" \
| node -e '
  const fs = require("fs");
  const jsonOnly = process.argv[1] === "1";
  const j = JSON.parse(fs.readFileSync(0,"utf8"));
  const d = j.data || {};
  const out = { count: d.count ?? 0, items: d.items ?? [] };
  process.stdout.write(jsonOnly ? JSON.stringify(out) : JSON.stringify(out, null, 2));
' "$json_only"
echo
