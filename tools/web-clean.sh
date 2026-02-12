#!/bin/bash

set -e

echo "====================================="
echo "   AUTOESCOLA WEB CLEANER v1"
echo "====================================="

BASE="apps/web/src"

MODULES=(
  "auth:Login.tsx"
  "dashboard:Dashboard.tsx"
  "admin:AdminDashboard.tsx"
)

echo "🧹 Limpando estrutura antiga..."

# Remove módulos quebrados, duplicados, antigos
rm -rf $BASE/modules
rm -rf $BASE/hooks
rm -rf $BASE/services
rm -rf $BASE/components/cards
rm -rf $BASE/modules_old
rm -rf $BASE/pages
rm -rf $BASE/views

echo "📁 Estrutura anterior limpa!"

echo "📦 Criando estrutura nova..."

mkdir -p $BASE/modules
mkdir -p $BASE/router

# Criar pastas dos módulos
for MOD in "${MODULES[@]}"; do
  FOLDER=$(echo $MOD | cut -d: -f1)
  mkdir -p "$BASE/modules/$FOLDER"
done

echo "📚 Estrutura de módulos recriada!"


echo "🔍 Movendo ou criando arquivos..."

for MOD in "${MODULES[@]}"; do
  FOLDER=$(echo $MOD | cut -d: -f1)
  FILE=$(echo $MOD | cut -d: -f2)

  TARGET="$BASE/modules/$FOLDER/$FILE"

  # Procurar o arquivo pelo projeto inteiro
  FOUND=$(find apps/web/src -name "$FILE" 2>/dev/null | head -n 1)

  if [ -n "$FOUND" ]; then
    echo "✔ Encontrado: $FOUND"
    mv "$FOUND" "$TARGET"
    echo "➡ Movido para $TARGET"
  else
    echo "⚠ Arquivo $FILE não encontrado. Criando placeholder..."
    echo "// $FILE gerado automaticamente" > "$TARGET"
  fi
done

echo "🧭 Criando arquivo padrão do router..."

cat <<EOF > $BASE/router/index.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "../modules/auth/Login";
import Dashboard from "../modules/dashboard/Dashboard";
import AdminDashboard from "../modules/admin/AdminDashboard";

export default function Router() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
EOF

echo "🔧 Ajustando main.tsx..."

cat <<EOF > $BASE/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import Router from "./router/index";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
EOF

echo "🎯 Mapa final da estrutura:"
tree $BASE/modules

echo ""
echo "====================================="
echo "   LIMPEZA FINALIZADA COM SUCESSO!"
echo "   Agora só editar os arquivos!"
echo "====================================="
