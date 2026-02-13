#!/bin/bash
set -euo pipefail

# Teste automático das principais rotas da API NexoGestao
API_URL="${API_URL:-http://127.0.0.1:3000}"

echo "🚦 Diagnóstico HTTP da API em $API_URL"
echo "--------------------------------------------"

declare -a ENDPOINTS=(
  "/health"
  "/tracks"
  "/me"
)

for route in "${ENDPOINTS[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$route")
  case $status in
    200) echo "✅ [$status] $route OK" ;;
    201) echo "🟢 [$status] $route criado com sucesso" ;;
    400) echo "🟡 [$status] $route Bad Request" ;;
    401) echo "🟣 [$status] $route requer autenticação" ;;
    403) echo "🔒 [$status] $route proibido" ;;
    404) echo "🟠 [$status] $route não encontrado" ;;
    500) echo "🔴 [$status] $route erro interno" ;;
    *)   echo "⚪ [$status] $route resposta inesperada" ;;
  esac
done

echo
echo "🔐 Testando login e /me..."
LOGIN_JSON=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@demo.com","password":"demo"}')

TOKEN=$(echo "$LOGIN_JSON" | jq -r '.token // empty' 2>/dev/null || true)

if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
  echo "❌ Login falhou. Resposta:"
  echo "$LOGIN_JSON" | jq . 2>/dev/null || echo "$LOGIN_JSON"
  exit 1
fi

echo "✅ Token OK"
curl -s -H "Authorization: Bearer $TOKEN" "$API_URL/me" | jq || true

echo "--------------------------------------------"
echo "🧭 Diagnóstico concluído."
