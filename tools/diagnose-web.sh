#!/bin/bash

echo "=================="
echo " AUTOESCOLA WEB DIAGNOSTICS "
echo "=================="

echo
echo "[1] Testando se API está acessível..."
curl -s http://localhost:3000/health | jq || echo "❌ API fora do ar"

echo
echo "[2] Testando LOGIN manual..."
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@autoescola.com", "password": "123456"}' | jq

echo
echo "[3] Checando variável VITE_API_URL..."
if [ -f apps/web/.env ]; then
  cat apps/web/.env
else
  echo "⚠️  apps/web/.env não existe"
fi

echo
echo "[4] Testando acesso com token..."
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@autoescola.com", "password": "123456"}' | jq -r .access_token)

echo "TOKEN = $TOKEN"

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "❌ Login falhou — token não gerado"
else
  echo "Token OK — testando rota protegida /auth/whoami..."
  curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3000/auth/whoami | jq
fi

echo
echo "[5] Verificando build do front..."
cd apps/web
pnpm --version
ls -1 src/pages
ls -1 src/lib
ls -1 src/components
