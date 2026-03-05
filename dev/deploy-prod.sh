#!/usr/bin/env bash
# ============================================================
# NexoGestão — Script de Deploy de PRODUÇÃO (idempotente)
# ============================================================
# Uso:
#   ./dev/deploy-prod.sh
#
# Pré-requisitos:
#   - Docker e Docker Compose instalados
#   - Arquivo .env.prod preenchido (cp .env.prod.example .env.prod)
#   - Portas 80 e 443 abertas no firewall
#
# O script é idempotente: pode ser executado múltiplas vezes
# sem efeitos colaterais indesejados.
# ============================================================
set -euo pipefail

# ─── Garantir que estamos no diretório raiz do projeto ───────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$PROJECT_ROOT"

# ─── Cores ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()      { echo -e "${BLUE}[deploy]${NC}  $*"; }
log_ok()   { echo -e "${GREEN}[deploy]${NC}  ✅ $*"; }
log_warn() { echo -e "${YELLOW}[deploy]${NC}  ⚠️  $*"; }
log_err()  { echo -e "${RED}[deploy]${NC}  ❌ $*" >&2; }
die()      { log_err "$*"; exit 1; }

echo ""
echo -e "${YELLOW}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║       NexoGestão — Deploy de Produção                ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── 1. Validar dependências ─────────────────────────────────
log "Verificando dependências..."

command -v docker >/dev/null 2>&1 \
  || die "Docker não encontrado. Instale: https://docs.docker.com/engine/install/"

# Suporte a 'docker compose' (v2) e 'docker-compose' (v1)
if docker compose version >/dev/null 2>&1; then
  COMPOSE="docker compose"
elif command -v docker-compose >/dev/null 2>&1; then
  COMPOSE="docker-compose"
else
  die "Docker Compose não encontrado. Instale: https://docs.docker.com/compose/install/"
fi

command -v curl >/dev/null 2>&1 \
  || die "curl não encontrado. Instale: sudo apt-get install -y curl"

log_ok "Dependências validadas (docker, $COMPOSE, curl)"

# ─── 2. Carregar .env.prod ────────────────────────────────────
log "Carregando variáveis de ambiente de .env.prod..."

if [[ ! -f ".env.prod" ]]; then
  log_err "Arquivo .env.prod não encontrado!"
  log_warn "Crie-o a partir do exemplo:"
  echo "    cp .env.prod.example .env.prod"
  echo "    nano .env.prod"
  die "Abortando deploy."
fi

# Exportar variáveis (ignora comentários e linhas vazias)
set -a
# shellcheck disable=SC1091
source .env.prod
set +a

log_ok ".env.prod carregado"

# ─── 3. Validar variáveis obrigatórias ───────────────────────
log "Validando variáveis obrigatórias..."

REQUIRED_VARS=(
  "POSTGRES_PASSWORD"
  "JWT_SECRET"
  "NODE_ENV"
)

MISSING=()
for var in "${REQUIRED_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    MISSING+=("$var")
  fi
done

if [[ ${#MISSING[@]} -gt 0 ]]; then
  log_err "Variáveis obrigatórias não definidas no .env.prod:"
  for var in "${MISSING[@]}"; do
    echo "    - $var"
  done
  die "Preencha as variáveis e tente novamente."
fi

# Alertas para variáveis de produção importantes (não obrigatórias para subir)
WARN_VARS=("STRIPE_SECRET_KEY" "STRIPE_WEBHOOK_SECRET" "SENTRY_DSN_API")
for var in "${WARN_VARS[@]}"; do
  if [[ -z "${!var:-}" ]]; then
    log_warn "$var não configurado — funcionalidade relacionada operará em modo degradado"
  fi
done

log_ok "Variáveis validadas"

# ─── 4. Gerar SSL (Let's Encrypt) se DOMAIN e EMAIL existirem ─
DOMAIN="${DOMAIN:-}"
EMAIL="${EMAIL:-}"

if [[ -n "$DOMAIN" && -n "$EMAIL" ]]; then
  log "DOMAIN=$DOMAIN e EMAIL=$EMAIL detectados — verificando certificado SSL..."

  CERT_PATH="infra/nginx/ssl/fullchain.pem"
  if [[ -f "$CERT_PATH" ]]; then
    log_ok "Certificado SSL já existe em $CERT_PATH — pulando geração"
  else
    log "Gerando certificado SSL via Let's Encrypt para $DOMAIN..."
    if [[ -f "infra/nginx/generate-ssl.sh" ]]; then
      bash infra/nginx/generate-ssl.sh "$DOMAIN" "$EMAIL"
    else
      log_warn "Script generate-ssl.sh não encontrado — SSL não configurado"
    fi
  fi
else
  log_warn "DOMAIN ou EMAIL não definidos — SSL não será configurado automaticamente"
  log_warn "Certifique-se de que infra/nginx/ssl/fullchain.pem e privkey.pem existem"
fi

# ─── 5. Build e subir containers ─────────────────────────────
log "Construindo imagens Docker e subindo containers de produção..."

$COMPOSE -f docker-compose.prod.yml --env-file .env.prod pull --ignore-pull-failures 2>/dev/null || true
$COMPOSE -f docker-compose.prod.yml --env-file .env.prod up --build -d --remove-orphans

log_ok "Containers iniciados"

# ─── 6. Aguardar banco de dados ficar pronto ─────────────────
log "Aguardando PostgreSQL ficar saudável..."

MAX_WAIT=120
ELAPSED=0
while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  if $COMPOSE -f docker-compose.prod.yml exec -T postgres \
      pg_isready -U "${POSTGRES_USER:-nexo}" -d "${POSTGRES_DB:-nexogestao}" \
      >/dev/null 2>&1; then
    log_ok "PostgreSQL pronto"
    break
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done

if [[ $ELAPSED -ge $MAX_WAIT ]]; then
  log_err "PostgreSQL não ficou pronto em ${MAX_WAIT}s"
  $COMPOSE -f docker-compose.prod.yml logs postgres | tail -20
  die "Abortando deploy."
fi

# ─── 7. Aplicar Prisma migrate deploy ────────────────────────
log "Aplicando migrações do Prisma (prisma migrate deploy)..."

$COMPOSE -f docker-compose.prod.yml exec -T api \
  sh -c "cd /app && npx prisma migrate deploy" \
  || die "Falha ao aplicar migrações do Prisma"

log_ok "Migrações aplicadas"

# ─── 8. Aguardar API ficar saudável ──────────────────────────
log "Aguardando API /health responder..."

API_PORT="${API_PORT:-3000}"
MAX_WAIT=180
ELAPSED=0

while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  if curl -sf "http://localhost:${API_PORT}/health" >/dev/null 2>&1; then
    log_ok "API respondendo em /health"
    break
  fi
  sleep 5
  ELAPSED=$((ELAPSED + 5))
  log "  Aguardando API... (${ELAPSED}s/${MAX_WAIT}s)"
done

if [[ $ELAPSED -ge $MAX_WAIT ]]; then
  log_err "API não ficou saudável em ${MAX_WAIT}s"
  $COMPOSE -f docker-compose.prod.yml logs api | tail -30
  die "Abortando deploy."
fi

# ─── 9. Aguardar Web responder ────────────────────────────────
log "Aguardando Web / responder..."

WEB_PORT="${WEB_PORT:-3001}"
MAX_WAIT=60
ELAPSED=0

# Tentar via nginx (porta 80) ou diretamente no container web
WEB_URL="http://localhost:80"
while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  if curl -sf "$WEB_URL" >/dev/null 2>&1; then
    log_ok "Web respondendo em $WEB_URL"
    break
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done

if [[ $ELAPSED -ge $MAX_WAIT ]]; then
  log_warn "Web não respondeu em $WEB_URL em ${MAX_WAIT}s — verificando container..."
  $COMPOSE -f docker-compose.prod.yml logs web | tail -20
fi

# ─── 10. Rodar smoke test ─────────────────────────────────────
log "Executando smoke test de produção..."

if [[ -f "dev/smoke-prod.sh" ]]; then
  API_BASE="http://localhost:${API_PORT}" bash dev/smoke-prod.sh
  log_ok "Smoke test passou!"
else
  log_warn "dev/smoke-prod.sh não encontrado — pulando smoke test"
fi

# ─── Resumo final ─────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Deploy concluído com sucesso! 🚀               ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  API Health:  http://localhost:${API_PORT}/health"
if [[ -n "$DOMAIN" ]]; then
  echo -e "${GREEN}║${NC}  App:         https://app.${DOMAIN}"
  echo -e "${GREEN}║${NC}  API:         https://api.${DOMAIN}"
fi
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
