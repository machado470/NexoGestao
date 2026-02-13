#!/bin/bash
set -euo pipefail

ROOT_DIR="$(pwd)"

echo "🧠 Subindo Postgres..."
docker compose up -d postgres

echo "⏳ Aguardando Postgres ficar saudável..."
until docker inspect --format='{{.State.Health.Status}}' nexogestao_postgres 2>/dev/null | grep -q healthy; do
  sleep 2
done

echo "🧩 Aplicando schema (db push) + seed..."
cd apps/api
pnpm run prisma:push
pnpm run prisma:seed

cd "$ROOT_DIR"

echo "✅ Banco pronto e ambiente consistente"
