#!/usr/bin/env bash
set -euo pipefail

echo "=== Docker (postgres/redis) ==="
if docker info >/dev/null 2>&1; then
  docker compose logs --tail=80 postgres redis || true
else
  echo "⚠️ Docker não está rodando. Não foi possível coletar logs de postgres/redis."
fi

echo
echo "=== Dica: logs de API/WEB do pnpm dev ==="
echo "O comando pnpm dev mostra os caminhos temporários dos logs (API=... WEB=...)."
echo "Abra com: tail -f <arquivo.log>"
