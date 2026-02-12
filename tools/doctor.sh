#!/usr/bin/env bash
set -e
trap 'echo -e "\033[1;31m[ERRO]\033[0m Linha $LINENO falhou: $BASH_COMMAND"' ERR

log(){ printf "\033[1;36m[%s]\033[0m %s\n" "$(date +%H:%M:%S)" "$*"; }

API_DIR="apps/api"
ENV_FILE=".env"

# 0) Pré-requisitos
command -v pnpm >/dev/null || { echo "pnpm não encontrado"; exit 1; }
command -v docker >/dev/null || { echo "docker não encontrado"; exit 1; }

# 1) Garantir DATABASE_URL
if ! grep -q '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null; then
  echo 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/autoescola?schema=public' > "$ENV_FILE"
  log ".env criado com DATABASE_URL padrão"
else
  log ".env ok"
fi

# 2) Subir containers
log "Subindo Docker (build se preciso)…"
docker-compose up -d --build

# 3) Prisma: generate + migrate (tenta aplicar e, se já aplicado, segue)
log "Prisma generate…"
pnpm -C "$API_DIR" exec prisma generate

log "Prisma migrate deploy…"
pnpm -C "$API_DIR" exec prisma migrate deploy || true

# 4) Seed automático (se existir)
if [ -f "$API_DIR/scripts/seed-auto.ts" ]; then
  log "Seed (scripts/seed-auto.ts)…"
  pnpm -C "$API_DIR" exec tsx scripts/seed-auto.ts || true
fi

# 5) Healthcheck da API
log "Healthcheck da API…"
curl -sf http://localhost:3000/health >/dev/null && log "API OK em http://localhost:3000" || { echo "⚠ health falhou"; exit 1; }
