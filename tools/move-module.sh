#!/bin/bash

# Uso:
#   ./tools/move-module.sh auth Login.tsx modules/auth
#   ./tools/move-module.sh dashboard Dashboard.tsx modules/dashboard

MODULE_NAME=$1
FILE_NAME=$2
DEST_FOLDER=$3

SRC="apps/web/src"
DEST="$SRC/$DEST_FOLDER"

# 1. Garante que destino existe
mkdir -p "$DEST"

# 2. Procura o arquivo em qualquer lugar do projeto
FILE_PATH=$(find "$SRC" -name "$FILE_NAME" | head -n 1)

if [ -z "$FILE_PATH" ]; then
  echo "❌ Arquivo $FILE_NAME não encontrado em nenhum lugar dentro de $SRC"
  exit 1
fi

echo "🔍 Encontrado: $FILE_PATH"
echo "📦 Movendo para: $DEST/$FILE_NAME"

mv "$FILE_PATH" "$DEST/$FILE_NAME"

echo "✅ Arquivo movido com sucesso!"
echo "📁 Agora está em: $DEST/$FILE_NAME"
