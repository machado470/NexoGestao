#!/bin/bash
set -e

ROOT_DIR=$(pwd)

echo "�� Preparando banco..."
./tools/dev-db.sh

echo "🚀 Subindo API..."
cd apps/api
pnpm run dev

cd "$ROOT_DIR"
