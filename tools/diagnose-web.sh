#!/bin/bash
set -e

echo "======================="
echo " NEXOGESTAO WEB DIAGNOSIS "
echo "======================="

echo
echo "[1] Testando se API está acessível..."
curl -s http://localhost:3000/health | jq || echo "❌ API fora do ar"

echo
echo "[2] Testando LOGIN..."
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@demo.com", "password": "demo"}' | jq

echo
echo "[3] Checando variável VITE_API_URL..."
if [ -f apps/web/.env ]; then
  cat apps/web/.env
else
  echo "⚠️  apps/web/.env não existe"
fi

echo
echo "[4] Testando acesso com token (/me)..."
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@demo.com", "password": "demo"}' | jq -r .token)

echo "TOKEN = $TOKEN"

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login falhou — token não gerado"
else
  echo "Token OK — testando rota protegida /me..."
  curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/me | jq
fi

echo
echo "[5] Verificando build do front..."
cd apps/web
pnpm --version
ls -1 src/pages
ls -1 src/lib || true
ls -1 src/components
