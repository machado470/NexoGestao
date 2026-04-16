#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "⚡ dev:fast iniciado (foco em ciclo diário)"
echo "ℹ️ Comportamento: infra + API + Web sem generate/migrate/seed por padrão."
echo "ℹ️ Use DEV_FAST_PREPARE=1 para preparar Prisma (generate + migrate) antes de subir."
echo "ℹ️ Use DEV_FAST_SEED=1 para rodar seed manualmente."

export DEV_FULL_SKIP_GENERATE="${DEV_FULL_SKIP_GENERATE:-1}"
export DEV_FULL_SKIP_MIGRATE="${DEV_FULL_SKIP_MIGRATE:-1}"
export DEV_FULL_SKIP_SEED="${DEV_FULL_SKIP_SEED:-1}"

if [ "${DEV_FAST_PREPARE:-0}" = "1" ]; then
  export DEV_FULL_SKIP_GENERATE=0
  export DEV_FULL_SKIP_MIGRATE=0
fi

if [ "${DEV_FAST_SEED:-0}" = "1" ]; then
  export DEV_FULL_SKIP_SEED=0
fi

exec ./scripts/dev-full.sh "$@"
