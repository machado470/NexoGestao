#!/usr/bin/env bash
set -e

green="\033[1;32m"
yellow="\033[1;33m"
red="\033[1;31m"
blue="\033[1;34m"
reset="\033[0m"
check="${green}✔${reset}"
info="${blue}ℹ${reset}"
cross="${red}✖${reset}"

START_TIME=$(date +%s)

echo -e "${blue}🩺 NexoGestao • doctor${reset}"
echo "----------------------------------------"

# 1) versões
echo -e "${info} Versões do ambiente:"
( node -v 2>/dev/null && pnpm -v 2>/dev/null && pnpm prisma -v 2>/dev/null | head -n 1 && docker -v 2>/dev/null ) || true
echo "----------------------------------------"

# 2) docker rodando?
if docker ps >/dev/null 2>&1; then
  echo -e "${check} Docker está rodando."
else
  echo -e "${cross} Docker NÃO está rodando. Inicie o Docker Desktop / serviço e rode de novo."
  exit 1
fi

# 3) container postgres
if docker ps --format '{{.Names}}' | grep -q '^nexogestao_postgres$'; then
  echo -e "${check} Container postgres do projeto está ativo: nexogestao_postgres"
  DB_HOST="nexogestao_postgres"
else
  echo -e "${yellow}⚠ Container nexogestao_postgres não está ativo. Vou usar localhost."
  DB_HOST="localhost"
fi

# 4) .env
if [ ! -f .env ]; then
  if [ -f .env.bak ]; then
    echo -e "${info} .env não existe, criando a partir de .env.bak..."
    cp .env.bak .env
  else
    echo -e "${cross} Nenhum .env nem .env.bak encontrado. Crie um .env para continuar."
    exit 1
  fi
fi

# 5) garantir DATABASE_URL
DB_URL="postgresql://postgres:postgres@${DB_HOST}:5432/autoescola?schema=public"
if grep -q '^DATABASE_URL=' .env; then
  # se tiver mas estiver diferente, atualiza
  sed -i "s|^DATABASE_URL=.*|DATABASE_URL=\"${DB_URL}\"|g" .env
  echo -e "${check} DATABASE_URL ajustada para ${DB_HOST}"
else
  echo "DATABASE_URL=\"${DB_URL}\"" >> .env
  echo -e "${check} DATABASE_URL adicionada ao .env"
fi

# 6) validar prisma
echo -e "${info} Validando Prisma..."
if pnpm prisma validate >/dev/null 2>&1; then
  echo -e "${check} Prisma OK."
else
  echo -e "${cross} Prisma encontrou problema no schema ou na conexão. Veja o log acima."
  exit 1
fi

# 7) checar scripts utilitários
echo -e "${info} Verificando scripts auxiliares..."
for f in scripts/api.sh scripts/backup-db.sh; do
  if [ -f "$f" ]; then
    chmod +x "$f" || true
    echo -e "${check} $f encontrado e marcado como executável."
  else
    echo -e "${yellow}⚠ $f não encontrado."
  fi
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "----------------------------------------"
echo -e "${green}✅ Diagnóstico concluído em ${ELAPSED}s.${reset}"
echo -e "${info} Para inspecionar a API: bash scripts/logs.sh"
echo -e "${info} Para testar resposta da stack: bash scripts/ping.sh"
