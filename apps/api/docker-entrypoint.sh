#!/bin/sh
set -e

echo "🚀 API ONLINE NA PORTA 3000"
echo "📁 Entrando no diretório da API"

cd /app/apps/api

echo "🔎 Prisma version:"
pnpm prisma -v || true

echo "🧱 Aplicando schema (db push)..."
pnpm prisma db push

SEED_MODE="${SEED_MODE:-demo}"

if [ "$SEED_MODE" = "demo" ]; then
  echo "🌱 Rodando seed (DEMO)..."
  pnpm prisma db seed
  echo "✅ Seed DEMO aplicado"
elif [ "$SEED_MODE" = "none" ]; then
  echo "🌱 Seed desativado (SEED_MODE=none)"
else
  echo "❌ SEED_MODE inválido: $SEED_MODE (use demo|none)"
  exit 1
fi

echo "🚀 Iniciando API..."
exec node dist/main.js
