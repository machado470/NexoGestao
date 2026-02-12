#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# JurisFlow API CLI
# - Auto-login com cache de token
# - Saída limpa (JSON) por padrão
# - --raw mostra headers (debug)
# - publish-latest <slug>: publica a última DRAFT daquele slug
# - create-draft "<title>": cria trilha DRAFT e devolve JSON
# ============================================================

API_URL="${API_URL:-http://localhost:3000}"
CACHE_DIR="${CACHE_DIR:-.cache}"
TOKEN_FILE="${TOKEN_FILE:-$CACHE_DIR/jurisflow.token}"
AUTH_FILE="${AUTH_FILE:-$CACHE_DIR/jurisflow.auth.json}"

EMAIL="${JURISFLOW_EMAIL:-admin@demo.com}"
PASSWORD="${JURISFLOW_PASSWORD:-demo}"

mkdir -p "$CACHE_DIR"

need_bin() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ Faltando dependency: $1"
    exit 1
  }
}

need_bin curl
need_bin jq
need_bin base64

RAW=0
if [[ "${1:-}" == "--raw" ]]; then
  RAW=1
  shift
fi

usage() {
  cat <<'EOF'
Uso:
  scripts/api.sh [--raw] health
  scripts/api.sh [--raw] login
  scripts/api.sh [--raw] me

  scripts/api.sh [--raw] tracks
  scripts/api.sh [--raw] track <trackId>

  scripts/api.sh [--raw] create-draft "<title>" ["<description>"]
  scripts/api.sh [--raw] publish <trackId>
  scripts/api.sh [--raw] publish-latest <slug>
  scripts/api.sh [--raw] archive <trackId>

  scripts/api.sh [--raw] track-items <trackId>
  scripts/api.sh [--raw] add-item <trackId> "<title>" "<type>" ["<content>"]

  scripts/api.sh [--raw] assign <trackId> <personId1> [personId2 ...]
  scripts/api.sh [--raw] unassign <trackId> <personId1> [personId2 ...]

  scripts/api.sh [--raw] assignments <personId>
  scripts/api.sh [--raw] start <assignmentId>
  scripts/api.sh [--raw] next-item <assignmentId>
  scripts/api.sh [--raw] complete-item <assignmentId> <itemId>

Flags:
  --raw   mostra headers HTTP (debug)

Env:
  API_URL=http://localhost:3000
  JURISFLOW_EMAIL=admin@demo.com
  JURISFLOW_PASSWORD=demo

Dica:
  - "type" do add-item: READING | ACTION | CHECKPOINT
EOF
}

# ------------------------------------------------------------
# Token cache (com exp)
# ------------------------------------------------------------
read_cached_token() {
  [[ -f "$TOKEN_FILE" ]] || return 1
  local token exp now
  token="$(tr -d '\n' < "$TOKEN_FILE")"
  [[ -n "$token" && "$token" != "null" ]] || return 1

  local payload_b64 payload_json
  payload_b64="$(echo "$token" | awk -F. '{print $2}')"
  [[ -n "$payload_b64" ]] || return 1

  payload_b64="${payload_b64//-/+}"
  payload_b64="${payload_b64//_//}"

  case $((${#payload_b64} % 4)) in
    2) payload_b64="${payload_b64}==";;
    3) payload_b64="${payload_b64}=";;
    0) ;;
    *) return 1;;
  esac

  payload_json="$(echo "$payload_b64" | base64 -d 2>/dev/null || true)"
  [[ -n "$payload_json" ]] || return 1

  exp="$(echo "$payload_json" | jq -r '.exp // empty' 2>/dev/null || true)"
  [[ -n "$exp" ]] || return 1

  now="$(date +%s)"
  if (( exp <= now + 60 )); then
    return 1
  fi

  echo "$token"
}

login_and_cache() {
  local resp token
  resp="$(curl -sS -X POST "$API_URL/auth/login" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")"

  token="$(echo "$resp" | jq -r '.token // empty')"
  if [[ -z "$token" || "$token" == "null" ]]; then
    echo "❌ Falha no login. Resposta:"
    echo "$resp" | jq .
    exit 1
  fi

  echo -n "$token" > "$TOKEN_FILE"
  echo "$resp" > "$AUTH_FILE"
  echo "$token"
}

get_token() {
  read_cached_token || login_and_cache
}

auth_header() {
  local token
  token="$(get_token)"
  echo "Authorization: Bearer $token"
}

# ------------------------------------------------------------
# HTTP helpers (limpo por padrão)
# ------------------------------------------------------------
curl_request() {
  local method="$1"
  local path="$2"
  local body="${3:-}"

  if (( RAW == 1 )); then
    if [[ -n "$body" ]]; then
      curl -sS -i -X "$method" \
        -H "$(auth_header)" \
        -H "Content-Type: application/json" \
        -d "$body" \
        "$API_URL$path"
    else
      curl -sS -i -X "$method" \
        -H "$(auth_header)" \
        "$API_URL$path"
    fi
    return 0
  fi

  local status bodyfile
  bodyfile="$(mktemp)"

  if [[ -n "$body" ]]; then
    status="$(curl -sS -o "$bodyfile" -w "%{http_code}" -X "$method" \
      -H "$(auth_header)" \
      -H "Content-Type: application/json" \
      -d "$body" \
      "$API_URL$path")"
  else
    status="$(curl -sS -o "$bodyfile" -w "%{http_code}" -X "$method" \
      -H "$(auth_header)" \
      "$API_URL$path")"
  fi

  if [[ "$status" -ge 400 ]]; then
    if jq -e . >/dev/null 2>&1 < "$bodyfile"; then
      jq . < "$bodyfile"
    else
      cat "$bodyfile"
    fi
    echo
    echo "❌ HTTP $status ($method $path)"
    rm -f "$bodyfile"
    exit 1
  fi

  if [[ -s "$bodyfile" ]]; then
    if jq -e . >/dev/null 2>&1 < "$bodyfile"; then
      jq . < "$bodyfile"
    else
      cat "$bodyfile"
    fi
  fi

  rm -f "$bodyfile"
}

api_get()    { curl_request "GET"    "$1"; }
api_post()   { curl_request "POST"   "$1" "${2:-}"; }
api_patch()  { curl_request "PATCH"  "$1" "${2:-}"; }
api_delete() { curl_request "DELETE" "$1"; }

# ------------------------------------------------------------
# Helpers de domínio (slug -> draft mais recente)
# ------------------------------------------------------------
find_latest_draft_id_by_slug() {
  local slug="${1:?slug obrigatório}"

  local id
  id="$(
    api_get "/tracks" \
      | jq -r --arg slug "$slug" '
          map(select(.slug == $slug and .status == "DRAFT"))
          | sort_by(.version)
          | last
          | .id // empty
        '
  )"

  if [[ -z "$id" || "$id" == "null" ]]; then
    echo "❌ Nenhuma trilha DRAFT encontrada para slug: $slug"
    echo "👉 Dica: veja o que existe com: scripts/api.sh tracks"
    exit 1
  fi

  echo "$id"
}

# ------------------------------------------------------------
# Commands
# ------------------------------------------------------------
cmd="${1:-}"
shift || true

case "$cmd" in
  ""|-h|--help|help)
    usage
    exit 0
    ;;

  health)
    curl -sS "$API_URL/health" | jq . 2>/dev/null || curl -sS "$API_URL/health"
    echo
    ;;

  login)
    login_and_cache >/dev/null
    echo "✅ token atualizado em $TOKEN_FILE"
    ;;

  me)
    api_get "/me"
    ;;

  tracks)
    api_get "/tracks"
    ;;

  track)
    id="${1:?trackId obrigatório}"
    api_get "/tracks/$id"
    ;;

  create-draft)
    title="${1:?title obrigatório}"
    desc="${2:-}"
    api_post "/tracks" \
      "$(jq -nc --arg title "$title" --arg description "$desc" \
        '{title:$title,description:($description|select(length>0))}')"
    ;;

  publish)
    id="${1:?trackId obrigatório}"
    api_post "/tracks/$id/publish"
    ;;

  publish-latest)
    slug="${1:?slug obrigatório}"
    id="$(find_latest_draft_id_by_slug "$slug")"
    api_post "/tracks/$id/publish"
    ;;

  archive)
    id="${1:?trackId obrigatório}"
    api_post "/tracks/$id/archive"
    ;;

  track-items)
    trackId="${1:?trackId obrigatório}"
    api_get "/track-items/track/$trackId"
    ;;

  add-item)
    trackId="${1:?trackId obrigatório}"
    title="${2:?title obrigatório}"
    type="${3:?type obrigatório (READING|ACTION|CHECKPOINT)}"
    content="${4:-}"
    api_post "/track-items/track/$trackId" \
      "$(jq -nc --arg title "$title" --arg type "$type" --arg content "$content" \
        '{title:$title,type:$type,content:($content|select(length>0))}')"
    ;;

  assign)
    trackId="${1:?trackId obrigatório}"
    shift
    [[ $# -ge 1 ]] || { echo "❌ informe ao menos 1 personId"; exit 1; }
    api_post "/tracks/$trackId/assign" \
      "$(jq -nc --argjson ids "$(printf '%s\n' "$@" | jq -R . | jq -s .)" '{personIds:$ids}')"
    ;;

  unassign)
    trackId="${1:?trackId obrigatório}"
    shift
    [[ $# -ge 1 ]] || { echo "❌ informe ao menos 1 personId"; exit 1; }
    api_post "/tracks/$trackId/unassign" \
      "$(jq -nc --argjson ids "$(printf '%s\n' "$@" | jq -R . | jq -s .)" '{personIds:$ids}')"
    ;;

  assignments)
    personId="${1:?personId obrigatório}"
    api_get "/assignments/person/$personId"
    ;;

  start)
    assignmentId="${1:?assignmentId obrigatório}"
    api_post "/assignments/$assignmentId/start"
    ;;

  next-item)
    assignmentId="${1:?assignmentId obrigatório}"
    api_get "/assignments/$assignmentId/next-item"
    ;;

  complete-item)
    assignmentId="${1:?assignmentId obrigatório}"
    itemId="${2:?itemId obrigatório}"
    api_post "/assignments/$assignmentId/complete-item" \
      "$(jq -nc --arg itemId "$itemId" '{itemId:$itemId}')"
    ;;

  *)
    echo "❌ comando desconhecido: $cmd"
    usage
    exit 1
    ;;
esac
