#!/bin/bash
set -e

ROOT_DIR=$(pwd)

echo "�� Subindo Postgres..."
docker compose up -d postgres

echo "⏳ Aguardando Postgres ficar saudável..."
until docker inspect --format='{{.State.Health.Status}}' autoescola_postgres 2>/dev/null | grep -q healthy; do
  sleep 2
done

echo "🧠 Aplicando schema e seed..."
cd apps/api
pnpm run dev:reset-db

cd "$ROOT_DIR"

echo "✅ Banco pronto e ambiente consistente"
