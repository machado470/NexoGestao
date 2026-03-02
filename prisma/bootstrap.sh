#!/bin/sh
set -e

echo "⏳ Aguardando Postgres ficar disponível..."

until pg_isready -h postgres -p 5432 -U postgres; do
  sleep 1
done

echo "✅ Postgres disponível"

echo "🧱 Aplicando schema Prisma (db push com accept-data-loss)..."
npx prisma db push --accept-data-loss

echo "🌱 Rodando seed..."
npx prisma db seed

echo "🚀 Iniciando API..."
node dist/main.js
