#!/usr/bin/env bash
set -euo pipefail

DB_URL="postgresql://postgres:postgres@postgres:5432/nexogestao?schema=public"

echo "🚀 Reiniciando NexoGestao..."
docker compose down -v --remove-orphans

echo "🧠 Subindo Postgres..."
docker compose up -d postgres

echo "⏳ Aguardando Postgres ficar saudável..."
for i in {1..40}; do
  if docker inspect --format='{{.State.Health.Status}}' nexogestao_postgres 2>/dev/null | grep -q healthy; then
    break
  fi
  sleep 1
done

echo "🧩 Aplicando migrações (sem rodar entrypoint da API)..."
docker compose run --rm --entrypoint sh api -lc "
set -e
cd /app/apps/api
export DATABASE_URL='$DB_URL'
pnpm exec prisma migrate deploy --schema ./prisma/schema.prisma
"

echo "🌱 Rodando seed (sem rodar entrypoint da API)..."
docker compose run --rm --entrypoint sh api -lc "
set -e
cd /app/apps/api
export DATABASE_URL='$DB_URL'
pnpm exec prisma db seed --schema ./prisma/schema.prisma
"

echo "🔧 Subindo API..."
docker compose up -d api

echo "⏳ Aguardando API..."
for i in {1..40}; do
  if curl -sf http://localhost:3000/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "🩺 Healthcheck..."
curl -s http://localhost:3000/health | jq || echo "⚠️ API não respondeu JSON"

echo "✅ NexoGestao pronto."
