#!/usr/bin/env bash
# ============================================================
# NexoGestão — Geração de Certificado SSL
# ============================================================
# Suporta dois modos:
#   1. Let's Encrypt (produção) — quando DOMAIN e EMAIL são fornecidos
#   2. Self-signed (desenvolvimento local) — fallback automático
#
# Uso:
#   ./infra/nginx/generate-ssl.sh <DOMAIN> <EMAIL>
#   ./infra/nginx/generate-ssl.sh localhost          # self-signed
#
# Chamado automaticamente pelo deploy-prod.sh quando
# DOMAIN e EMAIL estiverem definidos no .env.prod.
# ============================================================
set -euo pipefail

DOMAIN="${1:-localhost}"
EMAIL="${2:-}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
SSL_DIR="$SCRIPT_DIR/ssl"
CERTBOT_WWW="$PROJECT_ROOT/infra/certbot/www"
CERTBOT_CONF="$PROJECT_ROOT/infra/certbot/conf"

# ─── Cores ───────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()      { echo -e "${GREEN}[ssl]${NC}  $*"; }
log_warn() { echo -e "${YELLOW}[ssl]${NC}  ⚠️  $*"; }
log_err()  { echo -e "${RED}[ssl]${NC}  ❌ $*" >&2; }

# ─── Função auxiliar: gerar self-signed ──────────────────────
generate_self_signed() {
  local domain="$1"
  log "Gerando certificado self-signed para: $domain"
  mkdir -p "$SSL_DIR"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$SSL_DIR/privkey.pem" \
    -out "$SSL_DIR/fullchain.pem" \
    -subj "/C=BR/ST=SP/L=SaoPaulo/O=NexoGestao/CN=$domain" \
    -addext "subjectAltName=DNS:$domain,DNS:www.$domain,DNS:app.$domain,DNS:api.$domain,IP:127.0.0.1" \
    2>/dev/null
  log "Certificado self-signed gerado em $SSL_DIR/"
  log_warn "Este certificado NÃO é confiável pelos navegadores."
  log_warn "Para produção, configure DOMAIN e EMAIL no .env.prod"
}

mkdir -p "$SSL_DIR" "$CERTBOT_WWW" "$CERTBOT_CONF"

# ─── Modo Let's Encrypt (produção) ───────────────────────────
if [[ -n "$EMAIL" && "$DOMAIN" != "localhost" && "$DOMAIN" != "127.0.0.1" ]]; then
  log "Modo Let's Encrypt para domínio: $DOMAIN (email: $EMAIL)"

  # Verificar se já existe certificado válido via certbot conf
  CERTBOT_CONF_CERT="$CERTBOT_CONF/live/$DOMAIN/fullchain.pem"

  if [[ -f "$CERTBOT_CONF_CERT" ]]; then
    log "Certificado Let's Encrypt já existe para $DOMAIN"
    # Criar symlinks para o diretório ssl/ esperado pelo nginx
    ln -sf "$CERTBOT_CONF/live/$DOMAIN/fullchain.pem" "$SSL_DIR/fullchain.pem"
    ln -sf "$CERTBOT_CONF/live/$DOMAIN/privkey.pem" "$SSL_DIR/privkey.pem"
    log "Symlinks atualizados em $SSL_DIR/"
    exit 0
  fi

  # Verificar se certbot está disponível no sistema
  if command -v certbot >/dev/null 2>&1; then
    log "Usando certbot instalado no sistema..."

    # Parar nginx temporariamente se estiver rodando (para usar standalone)
    if command -v docker >/dev/null 2>&1; then
      COMPOSE_CMD="docker compose"
      command -v docker-compose >/dev/null 2>&1 && COMPOSE_CMD="docker-compose"
      cd "$PROJECT_ROOT"
      $COMPOSE_CMD -f docker-compose.prod.yml stop nginx 2>/dev/null || true
    fi

    # Tentar com subdomínios app. e api., fallback para domínio raiz apenas
    certbot certonly \
      --standalone \
      --non-interactive \
      --agree-tos \
      --email "$EMAIL" \
      -d "$DOMAIN" \
      -d "app.$DOMAIN" \
      -d "api.$DOMAIN" \
      2>/dev/null || \
    certbot certonly \
      --standalone \
      --non-interactive \
      --agree-tos \
      --email "$EMAIL" \
      -d "$DOMAIN"

    # Criar symlinks para o diretório ssl/
    SYSTEM_CERT="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
    if [[ -f "$SYSTEM_CERT" ]]; then
      ln -sf "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" "$SSL_DIR/fullchain.pem"
      ln -sf "/etc/letsencrypt/live/$DOMAIN/privkey.pem" "$SSL_DIR/privkey.pem"
      log "Certificado Let's Encrypt gerado e symlinks criados em $SSL_DIR/"
    else
      log_warn "Certificado não encontrado após certbot — gerando self-signed como fallback"
      generate_self_signed "$DOMAIN"
    fi

  elif command -v docker >/dev/null 2>&1; then
    log "Usando certbot via Docker (webroot)..."
    cd "$PROJECT_ROOT"
    COMPOSE_CMD="docker compose"
    command -v docker-compose >/dev/null 2>&1 && COMPOSE_CMD="docker-compose"

    # Subir apenas nginx para o desafio webroot
    log "Iniciando nginx para desafio ACME webroot..."
    $COMPOSE_CMD -f docker-compose.prod.yml --env-file .env.prod up -d nginx 2>/dev/null || true
    sleep 5

    # Executar certbot via Docker com webroot
    docker run --rm \
      -v "$CERTBOT_CONF:/etc/letsencrypt" \
      -v "$CERTBOT_WWW:/var/www/certbot" \
      certbot/certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN" \
        -d "app.$DOMAIN" \
        -d "api.$DOMAIN" \
        2>/dev/null || \
    docker run --rm \
      -v "$CERTBOT_CONF:/etc/letsencrypt" \
      -v "$CERTBOT_WWW:/var/www/certbot" \
      certbot/certbot certonly \
        --webroot \
        --webroot-path /var/www/certbot \
        --non-interactive \
        --agree-tos \
        --email "$EMAIL" \
        -d "$DOMAIN"

    # Criar symlinks para o diretório ssl/ esperado pelo nginx
    if [[ -f "$CERTBOT_CONF/live/$DOMAIN/fullchain.pem" ]]; then
      ln -sf "$CERTBOT_CONF/live/$DOMAIN/fullchain.pem" "$SSL_DIR/fullchain.pem"
      ln -sf "$CERTBOT_CONF/live/$DOMAIN/privkey.pem" "$SSL_DIR/privkey.pem"
      log "Certificado Let's Encrypt gerado e symlinks criados em $SSL_DIR/"
    else
      log_warn "Certificado não encontrado após certbot — gerando self-signed como fallback"
      generate_self_signed "$DOMAIN"
    fi

  else
    log_warn "certbot e docker não encontrados — gerando certificado self-signed como fallback"
    log_warn "Para produção real, instale certbot: sudo apt-get install -y certbot"
    generate_self_signed "$DOMAIN"
  fi

else
  # ─── Modo self-signed (desenvolvimento) ──────────────────────
  generate_self_signed "$DOMAIN"
fi

log "SSL configurado com sucesso!"
log "Arquivos: $SSL_DIR/fullchain.pem e $SSL_DIR/privkey.pem"
