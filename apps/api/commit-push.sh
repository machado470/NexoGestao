#!/bin/bash

# Script automático de commit e push
BRANCH=$(git branch --show-current)
echo "🚀 Branch atual: $BRANCH"

# Verificar se há alterações
if [ -z "$(git status --porcelain)" ]; then
  echo "✅ Nenhuma alteração para commit."
  exit 0
fi

# Solicitar mensagem de commit
read -p "📝 Mensagem do commit: " COMMIT_MSG

if [ -z "$COMMIT_MSG" ]; then
  echo "⚠️ Nenhuma mensagem informada. Abortando."
  exit 1
fi

# Executar commit e push
echo "📦 Adicionando e commitando alterações..."
git add .
git commit -m "$COMMIT_MSG"

echo "⬆️ Enviando para o remoto..."
git push origin "$BRANCH"

echo "✅ Commit e push concluídos!"
