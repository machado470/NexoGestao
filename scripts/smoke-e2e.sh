#!/usr/bin/env bash
# =============================================================================
# NexoGestão - Smoke Test E2E
# =============================================================================
# Executa um fluxo completo de ponta a ponta para validar a saúde do sistema:
#   login → create customer → create service order → create charge
#   → register payment → create expense → issue invoice → consult dashboard
#
# Uso:
#   ./scripts/smoke-e2e.sh [BASE_URL] [EMAIL] [PASSWORD]
#
# Exemplos:
#   ./scripts/smoke-e2e.sh http://localhost:3000
#   ./scripts/smoke-e2e.sh https://api.nexogestao.com.br admin@nexo.com senha123
# =============================================================================

set -euo pipefail

# ─── Configuração ─────────────────────────────────────────────────────────────
BASE_URL="${1:-http://localhost:3000}"
EMAIL="${2:-admin@nexo.com}"
PASSWORD="${3:-Admin@123}"

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
    echo -e "${RED}[ERROR]${NC} Comando '$1' não encontrado. Instale-o e tente novamente."
    exit 1
  fi
}

# Verifica dependências
require_command curl
require_command jq

# ─── Função de requisição HTTP ─────────────────────────────────────────────────
http_request() {
  local method="$1"
  local path="$2"
  local data="${3:-}"
  local token="${4:-}"

  local headers=(-H "Content-Type: application/json")
  if [[ -n "$token" ]]; then
    headers+=(-H "Authorization: Bearer $token")
  fi

  if [[ -n "$data" ]]; then
    curl -s -X "$method" "${BASE_URL}${path}" "${headers[@]}" -d "$data"
  else
    curl -s -X "$method" "${BASE_URL}${path}" "${headers[@]}"
  fi
}

# ─── Início do Smoke Test ──────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║     NexoGestão - Smoke Test E2E                     ║${NC}"
echo -e "${YELLOW}║     $(date '+%Y-%m-%d %H:%M:%S')                          ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════╝${NC}"
log_info "Base URL: $BASE_URL"
log_info "Email: $EMAIL"

# ─── PASSO 1: Health Check ─────────────────────────────────────────────────────
log_section "PASSO 1: Health Check"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/health" 2>/dev/null || echo "000")
if [[ "$HEALTH" == "200" ]]; then
  log_ok "API está respondendo (HTTP $HEALTH)"
else
  log_fail "API não está respondendo (HTTP $HEALTH)"
  echo -e "${RED}[ABORT]${NC} Não é possível continuar sem a API. Verifique se o servidor está rodando."
  exit 1
fi

# ─── PASSO 2: Login ────────────────────────────────────────────────────────────
log_section "PASSO 2: Autenticação"
LOGIN_RESPONSE=$(http_request "POST" "/auth/login" "{\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}")
TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token // .token // empty' 2>/dev/null || echo "")

if [[ -n "$TOKEN" && "$TOKEN" != "null" ]]; then
  log_ok "Login realizado com sucesso"
  log_info "Token: ${TOKEN:0:20}..."
else
  log_fail "Falha no login. Resposta: $LOGIN_RESPONSE"
  echo -e "${RED}[ABORT]${NC} Não é possível continuar sem autenticação."
  exit 1
fi

# ─── PASSO 3: Criar Cliente ────────────────────────────────────────────────────
log_section "PASSO 3: Criar Cliente"
TIMESTAMP=$(date +%s)
CUSTOMER_DATA="{
  \"name\": \"Cliente Smoke Test $TIMESTAMP\",
  \"email\": \"smoke-$TIMESTAMP@test.com\",
  \"phone\": \"11999999999\",
  \"document\": \"12345678901\"
}"

CUSTOMER_RESPONSE=$(http_request "POST" "/customers" "$CUSTOMER_DATA" "$TOKEN")
CUSTOMER_ID=$(echo "$CUSTOMER_RESPONSE" | jq -r '.id // empty' 2>/dev/null || echo "")

if [[ -n "$CUSTOMER_ID" && "$CUSTOMER_ID" != "null" ]]; then
  log_ok "Cliente criado com ID: $CUSTOMER_ID"
else
  log_fail "Falha ao criar cliente. Resposta: $CUSTOMER_RESPONSE"
fi

# ─── PASSO 4: Criar Ordem de Serviço ──────────────────────────────────────────
log_section "PASSO 4: Criar Ordem de Serviço"
if [[ -n "$CUSTOMER_ID" ]]; then
  SO_DATA="{
    \"customerId\": \"$CUSTOMER_ID\",
    \"title\": \"Serviço Smoke Test $TIMESTAMP\",
    \"description\": \"Teste automatizado de smoke test\",
    \"priority\": 2
  }"

  SO_RESPONSE=$(http_request "POST" "/service-orders" "$SO_DATA" "$TOKEN")
  SO_ID=$(echo "$SO_RESPONSE" | jq -r '.id // empty' 2>/dev/null || echo "")

  if [[ -n "$SO_ID" && "$SO_ID" != "null" ]]; then
    log_ok "Ordem de Serviço criada com ID: $SO_ID"
  else
    log_fail "Falha ao criar OS. Resposta: $SO_RESPONSE"
  fi
else
  log_fail "Pulando criação de OS (cliente não criado)"
fi

# ─── PASSO 5: Criar Despesa ────────────────────────────────────────────────────
log_section "PASSO 5: Criar Despesa"
EXPENSE_DATA="{
  \"description\": \"Despesa Smoke Test $TIMESTAMP\",
  \"amountCents\": 5000,
  \"category\": \"OPERATIONAL\",
  \"date\": \"$(date +%Y-%m-%d)\"
}"

EXPENSE_RESPONSE=$(http_request "POST" "/expenses" "$EXPENSE_DATA" "$TOKEN")
EXPENSE_ID=$(echo "$EXPENSE_RESPONSE" | jq -r '.id // empty' 2>/dev/null || echo "")

if [[ -n "$EXPENSE_ID" && "$EXPENSE_ID" != "null" ]]; then
  log_ok "Despesa criada com ID: $EXPENSE_ID"
else
  log_fail "Falha ao criar despesa. Resposta: $EXPENSE_RESPONSE"
fi

# ─── PASSO 6: Criar Fatura ─────────────────────────────────────────────────────
log_section "PASSO 6: Criar Fatura"
if [[ -n "$CUSTOMER_ID" ]]; then
  INVOICE_DATA="{
    \"customerId\": \"$CUSTOMER_ID\",
    \"number\": \"NF-SMOKE-$TIMESTAMP\",
    \"description\": \"Fatura Smoke Test\",
    \"amountCents\": 15000,
    \"status\": \"DRAFT\",
    \"dueDate\": \"$(date -d '+30 days' +%Y-%m-%d 2>/dev/null || date -v+30d +%Y-%m-%d 2>/dev/null || date +%Y-%m-%d)\"
  }"

  INVOICE_RESPONSE=$(http_request "POST" "/invoices" "$INVOICE_DATA" "$TOKEN")
  INVOICE_ID=$(echo "$INVOICE_RESPONSE" | jq -r '.id // empty' 2>/dev/null || echo "")

  if [[ -n "$INVOICE_ID" && "$INVOICE_ID" != "null" ]]; then
    log_ok "Fatura criada com ID: $INVOICE_ID"

    # ─── PASSO 7: Emitir Fatura (DRAFT → ISSUED) ──────────────────────────────
    log_section "PASSO 7: Emitir Fatura (DRAFT → ISSUED)"
    ISSUE_RESPONSE=$(http_request "PATCH" "/invoices/$INVOICE_ID" "{\"status\":\"ISSUED\"}" "$TOKEN")
    ISSUE_STATUS=$(echo "$ISSUE_RESPONSE" | jq -r '.status // empty' 2>/dev/null || echo "")

    if [[ "$ISSUE_STATUS" == "ISSUED" ]]; then
      log_ok "Fatura emitida com sucesso (status: ISSUED)"
    else
      log_fail "Falha ao emitir fatura. Resposta: $ISSUE_RESPONSE"
    fi
  else
    log_fail "Falha ao criar fatura. Resposta: $INVOICE_RESPONSE"
  fi
else
  log_fail "Pulando criação de fatura (cliente não criado)"
fi

# ─── PASSO 8: Criar Lançamento Financeiro ─────────────────────────────────────
log_section "PASSO 8: Criar Lançamento Financeiro"
LAUNCH_DATA="{
  \"description\": \"Lançamento Smoke Test $TIMESTAMP\",
  \"amountCents\": 10000,
  \"type\": \"INCOME\",
  \"category\": \"Serviços\",
  \"date\": \"$(date +%Y-%m-%d)\"
}"

LAUNCH_RESPONSE=$(http_request "POST" "/launches" "$LAUNCH_DATA" "$TOKEN")
LAUNCH_ID=$(echo "$LAUNCH_RESPONSE" | jq -r '.id // empty' 2>/dev/null || echo "")

if [[ -n "$LAUNCH_ID" && "$LAUNCH_ID" != "null" ]]; then
  log_ok "Lançamento criado com ID: $LAUNCH_ID"
else
  log_fail "Falha ao criar lançamento. Resposta: $LAUNCH_RESPONSE"
fi

# ─── PASSO 9: Consultar Dashboard ─────────────────────────────────────────────
log_section "PASSO 9: Consultar Dashboard"
DASHBOARD_RESPONSE=$(http_request "GET" "/dashboard" "" "$TOKEN")
DASHBOARD_OK=$(echo "$DASHBOARD_RESPONSE" | jq 'has("revenue") or has("totalRevenue") or has("summary") or has("kpis")' 2>/dev/null || echo "false")

if [[ "$DASHBOARD_OK" == "true" ]]; then
  log_ok "Dashboard consultado com sucesso"
else
  log_fail "Falha ao consultar dashboard. Resposta: $DASHBOARD_RESPONSE"
fi

# ─── PASSO 10: Limpeza (opcional) ─────────────────────────────────────────────
log_section "PASSO 10: Limpeza de Dados de Teste"
if [[ -n "${CLEANUP:-}" ]]; then
  [[ -n "$EXPENSE_ID" ]] && http_request "DELETE" "/expenses/$EXPENSE_ID" "" "$TOKEN" > /dev/null && log_ok "Despesa removida"
  [[ -n "$LAUNCH_ID" ]] && http_request "DELETE" "/launches/$LAUNCH_ID" "" "$TOKEN" > /dev/null && log_ok "Lançamento removido"
  log_info "Limpeza concluída"
else
  log_info "Limpeza pulada (defina CLEANUP=1 para ativar)"
fi

# ─── Resumo Final ──────────────────────────────────────────────────────────────
echo ""
echo -e "${YELLOW}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║                    RESUMO FINAL                     ║${NC}"
echo -e "${YELLOW}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${YELLOW}║${NC}  ${GREEN}PASSOU: $PASSED${NC}                                        ${YELLOW}║${NC}"
echo -e "${YELLOW}║${NC}  ${RED}FALHOU: $FAILED${NC}                                        ${YELLOW}║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════╝${NC}"

if [[ "$FAILED" -eq 0 ]]; then
  echo -e "\n${GREEN}✅ Todos os testes passaram! Sistema operacional.${NC}\n"
  exit 0
else
  echo -e "\n${RED}❌ $FAILED teste(s) falharam. Verifique os logs acima.${NC}\n"
  exit 1
fi
