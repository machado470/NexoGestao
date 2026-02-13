#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────────────────────────────────────
# NexoGestao Commit Bot 💎
# Uso: ./commit-push.sh "feat(web): sua mensagem de commit"
# ──────────────────────────────────────────────────────────────────────────────

NC='\033[0m'
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
GRAY='\033[0;90m'

start_ts=$(date +%s)

MSG="${1:-feat: atualizações menores}"
BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo 'unknown')"

on_error() {
  echo -e "\n${RED}✖ Opa! Algo falhou.${NC} ${GRAY}(verifique a mensagem acima)${NC}"
  exit 1
}
trap on_error ERR

git rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo -e "${RED}✖ Este diretório não é um repositório Git.${NC}"
  exit 1
}

echo -e "${BOLD}${CYAN}🚀 NexoGestao Commit Bot${NC}"
echo -e "${GRAY}──────────────────────────────────────────────────────────────${NC}"
echo -e "🪶  ${BOLD}Mensagem:${NC} ${MSG}"
echo -e "🌿  ${BOLD}Branch:${NC} ${BRANCH}"
echo -e "${GRAY}──────────────────────────────────────────────────────────────${NC}"

if git diff --quiet && git diff --cached --quiet; then
  echo -e "${YELLOW}ℹ Nada para commitar (working tree clean).${NC}"
  echo -e "${GRAY}Dica: edite arquivos ou faça mudanças antes de rodar o script.${NC}"
  exit 0
fi

pending_files=$(git status --porcelain | wc -l | xargs)

echo -e "📦 ${BOLD}Adicionando alterações...${NC} ${GRAY}(${pending_files} arquivo(s))${NC}"
git add -A

if git diff --cached --quiet; then
  echo -e "${YELLOW}ℹ Nada novo foi adicionado ao índice; commit evitado.${NC}"
  exit 0
fi

echo -e "🧱 ${BOLD}Criando commit...${NC}"
git commit -m "$MSG" >/dev/null

last_commit="$(git --no-pager log --oneline -n 1)"
echo -e "✅ ${GREEN}Commit criado:${NC} ${last_commit}"

echo -e "📤 ${BOLD}Enviando para${NC} origin/${BRANCH}..."
git push origin "$BRANCH" >/dev/null

end_ts=$(date +%s)
elapsed=$(( end_ts - start_ts ))

echo -e "${GREEN}✓ Commit & push concluídos!${NC}"
echo -e "${GRAY}──────────────────────────────────────────────────────────────${NC}"
echo -e "🧾 Último commit: ${BOLD}${last_commit}${NC}"
echo -e "⏱  Tempo total: ${BOLD}${elapsed}s${NC}"
echo -e "${GRAY}──────────────────────────────────────────────────────────────${NC}"
