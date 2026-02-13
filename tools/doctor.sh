#!/usr/bin/env bash
set -e
trap 'echo -e "\033[1;31m[ERRO]\033[0m Linha $LINENO falhou: $BASH_COMMAND"' ERR

log(){ printf "\033[1;36m[%s]\033[0m %s\n" "$(date +%H:%M:%S)" "$*"; }

API_DIR="apps/api"
ENV_FILE=".env"

command -v pnpm >/dev/null || { echo "pnpm não encontrado"; exit 1; }
command -v docker >/dev/null || { echo "docker não encontrado"; exit 1; }

if ! grep -q '^DATABASE_URL=' "$ENV_FILE" 2>/dev/null; then
  echo 'DATABASE_URL=postgresql://postgres:postgres@localhost:5432/nexogestao?schema=public' > "$ENV_FILE"
  log ".env criado com DATABASE_URL padrão"
else
  log ".env ok"
fi

log "Subindo Docker (build se preciso)…"
docker compose up -d --build

log "Prisma generate…"
pnpm -C "$API_DIR" exec prisma generate

log "Prisma migrate deploy…"
pnpm -C "$API_DIR" exec prisma migrate deploy || true

log "Seed (prisma db seed)…"
pnpm -C "$API_DIR" exec prisma db seed || true

log "Healthcheck da API…"
curl -sf http://localhost:3000/health >/dev/null && log "API OK em http://localhost:3000" || { echo "⚠ health falhou"; exit 1; }
