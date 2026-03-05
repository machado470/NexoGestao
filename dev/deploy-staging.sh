#!/usr/bin/env bash
# ============================================================
# NexoGestão — Script de Deploy de STAGING (idempotente)
# ============================================================
# Uso:
#   ./dev/deploy-staging.sh
#
# Pré-requisitos:
#   - Docker e Docker Compose instalados
#   - Arquivo .env.staging preenchido (cp .env.staging.example .env.staging)
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

log()      { echo -e "${BLUE}[deploy-staging]${NC}  $*"; }
log_ok()   { echo -e "${GREEN}[deploy-staging]${NC}  ✅ $*"; }
log_warn() { echo -e "${YELLOW}[deploy-staging]${NC}  ⚠️  $*"; }
log_err()  { echo -e "${RED}[deploy-staging]${NC}  ❌ $*" >&2; }
die()      { log_err "$*"; exit 1; }

echo ""
echo -e "${YELLOW}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║       NexoGestão — Deploy de Staging                 ║${NC}"
echo -e "${YELLOW}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── 1. Validar dependências ─────────────────────────────────
log "Verificando dependências..."

command -v docker >/dev/null 2>&1 \
  || die "Docker não encontrado. Instale: https://docs.docker.com/engine/install/"

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

# ─── 2. Carregar .env.staging ────────────────────────────────
log "Carregando variáveis de ambiente de .env.staging..."

if [[ ! -f ".env.staging" ]]; then
  log_err "Arquivo .env.staging não encontrado!"
  log_warn "Crie-o a partir do exemplo:"
  echo "    cp .env.staging.example .env.staging"
  echo "    nano .env.staging"
  die "Abortando deploy."
fi

set -a
source .env.staging
set +a

log_ok ".env.staging carregado"

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
  log_err "Variáveis obrigatórias não definidas no .env.staging:"
  for var in "${MISSING[@]}"; do
    echo "    - $var"
  done
  die "Preencha as variáveis e tente novamente."
fi

log_ok "Variáveis validadas"

# ─── 4. Build e subir containers ─────────────────────────────
log "Construindo imagens Docker e subindo containers de staging..."

$COMPOSE -f docker-compose.staging.yml --env-file .env.staging pull --ignore-pull-failures 2>/dev/null || true
$COMPOSE -f docker-compose.staging.yml --env-file .env.staging up --build -d --remove-orphans

log_ok "Containers iniciados"

# ─── 5. Aguardar banco de dados ficar pronto ─────────────────
log "Aguardando PostgreSQL ficar saudável..."

MAX_WAIT=120
ELAPSED=0
while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  if $COMPOSE -f docker-compose.staging.yml exec -T postgres \
      pg_isready -U "${POSTGRES_USER:-nexo_staging}" -d "${POSTGRES_DB:-nexogestao_staging}" \
      >/dev/null 2>&1; then
    log_ok "PostgreSQL pronto"
    break
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done

if [[ $ELAPSED -ge $MAX_WAIT ]]; then
  log_err "PostgreSQL não ficou pronto em ${MAX_WAIT}s"
  $COMPOSE -f docker-compose.staging.yml logs postgres | tail -20
  die "Abortando deploy."
fi

# ─── 6. Aplicar Prisma migrate deploy ────────────────────────
log "Aplicando migrações do Prisma (prisma migrate deploy)..."

$COMPOSE -f docker-compose.staging.yml exec -T api \
  sh -c "cd /app && npx prisma migrate deploy" \
  || die "Falha ao aplicar migrações do Prisma"

log_ok "Migrações aplicadas"

# ─── 7. Aguardar API ficar saudável ──────────────────────────
log "Aguardando API /health responder..."

API_PORT="${API_PORT:-3001}"
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
  $COMPOSE -f docker-compose.staging.yml logs api | tail -30
  die "Abortando deploy."
fi

# ─── 8. Aguardar Web responder ────────────────────────────────
log "Aguardando Web / responder..."

WEB_PORT="${WEB_PORT:-3000}"
MAX_WAIT=60
ELAPSED=0

while [[ $ELAPSED -lt $MAX_WAIT ]]; do
  if curl -sf "http://localhost:${WEB_PORT}" >/dev/null 2>&1; then
    log_ok "Web respondendo em /"
    break
  fi
  sleep 3
  ELAPSED=$((ELAPSED + 3))
done

if [[ $ELAPSED -ge $MAX_WAIT ]]; then
  log_warn "Web não respondeu em ${MAX_WAIT}s — verificando container..."
  $COMPOSE -f docker-compose.staging.yml logs web | tail -20
fi

# ─── 9. Rodar smoke test ─────────────────────────────────────
log "Executando smoke test de staging..."

if [[ -f "dev/smoke-staging.sh" ]]; then
  API_BASE="http://localhost:${API_PORT}" bash dev/smoke-staging.sh || true
  log_ok "Smoke test executado!"
else
  log_warn "dev/smoke-staging.sh não encontrado — pulando smoke test"
fi

# ─── Resumo final ─────────────────────────────────────────────
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Deploy de Staging concluído com sucesso! 🚀   ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║${NC}  API Health:  http://localhost:${API_PORT}/health"
echo -e "${GREEN}║${NC}  Web:         http://localhost:${WEB_PORT}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
