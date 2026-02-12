#!/bin/bash
# Teste automático das principais rotas da API AutoEscola Sim
# Autor: Codex Automation

API_URL="http://127.0.0.1:3000"
declare -a ENDPOINTS=(
  "/health"
  "/schools"
  "/schools/1"
  "/instructors"
  "/students"
  "/auth/login"
)

echo "🚦 Iniciando diagnóstico HTTP da API em $API_URL"
echo "--------------------------------------------"

for route in "${ENDPOINTS[@]}"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL$route")
  case $status in
    200) echo "✅ [$status] $route OK" ;;
    201) echo "🟢 [$status] $route criado com sucesso" ;;
    400) echo "🟡 [$status] $route erro de requisição (Bad Request)" ;;
    401) echo "🟣 [$status] $route requer autenticação" ;;
    403) echo "🔒 [$status] $route acesso proibido" ;;
    404) echo "🟠 [$status] $route não encontrado" ;;
    500) echo "🔴 [$status] $route erro interno no servidor" ;;
    *)   echo "⚪ [$status] $route resposta inesperada" ;;
  esac
done

echo "--------------------------------------------"
echo "🧭 Diagnóstico concluído."
