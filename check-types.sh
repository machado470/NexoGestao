#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/apps/api"

pnpm exec prisma generate --schema ../../prisma/schema.prisma
pnpm exec tsc --noEmit -p tsconfig.json
