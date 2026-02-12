#!/bin/bash
# ---------------------------------------------------------
# 🚀 Gera automaticamente o próximo patch e prepara ambiente
# ---------------------------------------------------------

# Detecta o último patch e incrementa
LAST_PATCH=$(git branch -r | grep "machado470-patch-" | sed 's/.*-//' | sort -n | tail -1)
NEXT_PATCH=$((LAST_PATCH + 1))
NEW_BRANCH="machado470-patch-$NEXT_PATCH"

echo "🧠 Criando novo ciclo: $NEW_BRANCH"
git checkout main >/dev/null 2>&1
git pull origin main

# Cria o novo branch
git checkout -b "$NEW_BRANCH"

# Sincroniza dependências
pnpm install --silent
chmod +x tools/*.sh

# Verifica containers
./tools/check-docker.sh

echo "✅ Branch $NEW_BRANCH pronto para desenvolvimento!"
