#!/bin/sh
set -e

echo "⏳ Aguardando Postgres ficar disponível..."

until pg_isready -h postgres -p 5432 -U postgres; do
  sleep 1
done

echo "✅ Postgres disponível"

echo "🧠 Gerando Prisma Client..."
npx prisma generate

echo "🧱 Aplicando migrations Prisma..."
npx prisma migrate deploy

echo "🌱 Rodando seed..."
npx prisma db seed

echo "🚀 Iniciando API..."
node dist/main.js
