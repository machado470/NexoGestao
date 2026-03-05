#!/usr/bin/env bash
# ============================================================
# Gera certificado SSL self-signed para desenvolvimento local
# Para produção, use Let's Encrypt via Certbot
# ============================================================
set -euo pipefail

DOMAIN="${1:-localhost}"
SSL_DIR="$(dirname "$0")/ssl"

mkdir -p "$SSL_DIR"

echo "[ssl] Gerando certificado self-signed para: $DOMAIN"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout "$SSL_DIR/privkey.pem" \
  -out "$SSL_DIR/fullchain.pem" \
  -subj "/C=BR/ST=SP/L=SaoPaulo/O=NexoGestao/CN=$DOMAIN" \
  -addext "subjectAltName=DNS:$DOMAIN,DNS:www.$DOMAIN,IP:127.0.0.1"

echo "[ssl] Certificado gerado em $SSL_DIR/"
echo "[ssl] Para produção, configure Let's Encrypt:"
echo "      docker compose -f docker-compose.prod.yml run --rm certbot certonly --webroot -w /var/www/certbot -d $DOMAIN"
