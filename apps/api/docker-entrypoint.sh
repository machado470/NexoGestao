#!/bin/sh
set -e

cd /app/apps/api

echo "🚀 NexoGestao API"
echo "📦 NODE_ENV=${NODE_ENV:-unknown}"
echo "🔎 Prisma version:"
pnpm prisma -v || true

# Se quiser que o container aplique migrações automaticamente, habilite:
# AUTO_MIGRATE=1
AUTO_MIGRATE="${AUTO_MIGRATE:-0}"

# Seed por padrão DESLIGADO (segurança).
# Opções: none | demo
SEED_MODE="${SEED_MODE:-none}"

if [ "$AUTO_MIGRATE" = "1" ]; then
  echo "🧩 Aplicando migrações (migrate deploy)..."
  pnpm prisma migrate deploy --schema ./prisma/schema.prisma
else
  echo "ℹ️ AUTO_MIGRATE=0 (não aplicando migrações no entrypoint)"
  echo "   Dica: use scripts/core/run-project.sh para migrate + seed controlados."
fi

if [ "$SEED_MODE" = "demo" ]; then
  echo "🌱 Rodando seed (DEMO)..."
  pnpm prisma db seed --schema ./prisma/schema.prisma
  echo "✅ Seed DEMO aplicado"
elif [ "$SEED_MODE" = "none" ]; then
  echo "🌱 Seed desativado (SEED_MODE=none)"
else
  echo "❌ SEED_MODE inválido: $SEED_MODE (use demo|none)"
  exit 1
fi

echo "✅ Iniciando API..."
exec node dist/main.js
