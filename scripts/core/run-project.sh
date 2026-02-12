#!/usr/bin/env bash
set -e

echo "🚀 Reiniciando AutoEscola-Sim..."
docker compose down -v

echo "🔧 Construindo containers..."
docker compose up -d --build

echo "🧩 Aplicando migrações..."
pnpm --filter @autoescola/api exec prisma migrate deploy

echo "🌱 Rodando seed..."
pnpm --filter @autoescola/api exec prisma db seed

echo "🩺 Testando API..."
curl -s http://localhost:3000/health | jq || echo "⚠️ API ainda não respondeu."

echo "✅ Projeto AutoEscola-Sim pronto!"
