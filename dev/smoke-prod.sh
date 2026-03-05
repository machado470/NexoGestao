#!/usr/bin/env bash
# ============================================================
# NexoGestão — Smoke Test de Produção
# ============================================================
# Executa testes básicos para validar se a aplicação está online
# e funcional após o deploy em produção.
#
# Uso:
#   ./dev/smoke-prod.sh [API_BASE_URL] [WEB_BASE_URL]
#
# Variáveis de ambiente:
#   API_BASE: URL base da API (ex: https://api.seudominio.com.br)
#   WEB_BASE: URL base do Web (ex: https://app.seudominio.com.br)
#   ADMIN_EMAIL: E-mail de um usuário admin para login
#   ADMIN_PASSWORD: Senha do usuário admin
#
# Este script é chamado automaticamente pelo deploy-prod.sh.
# ============================================================
set -euo pipefail

# ─── Configuração ─────────────────────────────────────────────
API_BASE="${API_BASE:-http://localhost:3000}" # Default para localhost se não setado
WEB_BASE="${WEB_BASE:-http://localhost:80}" # Default para localhost se não setado
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@nexo.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin@123}"

# Cores para output
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[1;33m
BLUE=\033[0;34m
NC=\033[0m # No Color

# Contadores
PASSED=0
FAILED=0

# ─── Funções Auxiliares ────────────────────────────────────────────────────────
log_info()    { echo -e "${BLUE}[INFO]${NC}  $1"; }
log_ok()      { echo -e "${GREEN}[PASS]${NC}  $1"; PASSED=$((PASSED+1)); }
log_fail()    { echo -e "${RED}[FAIL]${NC}  $1"; FAILED=$((FAILED+1)); }
log_section() { echo -e "\n${YELLOW}══════════════════════════════════════${NC}"; echo -e "${YELLOW}  $1${NC}"; echo -e "${YELLOW}══════════════════════════════════════${NC}"; }
require_command() {
  if ! command -v "$1" &>/dev/null; then
    log_fail "Comando 
$1
 não encontrado. Instale-o e tente novamente."
    exit 1
  fi
}

# Verifica dependências
require_command curl
require_command jq

# ─── Testes ───────────────────────────────────────────────────────────────────
log_section "Iniciando Smoke Test de Produção"

# Teste 1: API /health
log_info "Testando API Health Check: $API_BASE/health"
if curl -s -o /dev/null -w "%{http_code}" "$API_BASE/health" | grep -q "200"; then
  log_ok "API Health Check ($API_BASE/health) respondeu 200 OK."
else
  log_fail "API Health Check ($API_BASE/health) falhou."
fi

# Teste 2: Web Frontend (página inicial)
log_info "Testando Web Frontend: $WEB_BASE"
if curl -s -o /dev/null -w "%{http_code}" "$WEB_BASE" | grep -q "200"; then
  log_ok "Web Frontend ($WEB_BASE) respondeu 200 OK."
else
  log_fail "Web Frontend ($WEB_BASE) falhou."
fi

# Teste 3: Login na API
log_info "Testando login na API como $ADMIN_EMAIL"
LOGIN_RESPONSE=$(curl -s -X POST "$API_BASE/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r ".data.token // .token // empty")

if [[ -n "$TOKEN" ]]; then
  log_ok "Login na API bem-sucedido. Token recebido."
else
  log_fail "Login na API falhou. Resposta: $LOGIN_RESPONSE"
fi

# Teste 4: Acesso a endpoint autenticado (ex: /me)
if [[ -n "$TOKEN" ]]; then
  log_info "Testando acesso a endpoint autenticado ($API_BASE/me)"
  ME_RESPONSE=$(curl -s -H "Authorization: Bearer $TOKEN" "$API_BASE/me")
  USER_ID=$(echo "$ME_RESPONSE" | jq -r ".data.user.id // empty")
  if [[ -n "$USER_ID" ]]; then
    log_ok "Acesso a /me bem-sucedido. User ID: $USER_ID."
  else
    log_fail "Acesso a /me falhou. Resposta: $ME_RESPONSE"
  fi
else
  log_info "Pulando teste de endpoint autenticado: login falhou."
fi

# ─── Resumo Final ─────────────────────────────────────────────────────────────
log_section "Resumo do Smoke Test"
echo -e "${YELLOW}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║${NC}  ${GREEN}PASSOU: $PASSED${NC}                                        ${YELLOW}║${NC}"
echo -e "${YELLOW}║${NC}  ${RED}FALHOU: $FAILED${NC}                                        ${YELLOW}║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════╝${NC}"

if [[ "$FAILED" -eq 0 ]]; then
  log_ok "Todos os testes de smoke passaram! Aplicação online e funcional."
  exit 0
else
  log_err "$FAILED teste(s) de smoke falharam. Verifique os logs acima."
  exit 1
fi
