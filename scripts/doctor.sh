#!/usr/bin/env bash
set -euo pipefail

green="\033[1;32m"
yellow="\033[1;33m"
red="\033[1;31m"
blue="\033[1;34m"
reset="\033[0m"
check="${green}✔${reset}"
info="${blue}ℹ${reset}"
warn="${yellow}⚠${reset}"
cross="${red}✖${reset}"

START_TIME=$(date +%s)
issues=0

report_issue() {
  echo -e "${cross} $1"
  issues=$((issues + 1))
}

echo -e "${blue}🩺 NexoGestao • dev doctor (somente validação)${reset}"
echo "----------------------------------------"

echo -e "${info} Versões do ambiente:"
(node -v 2>/dev/null && pnpm -v 2>/dev/null && pnpm prisma -v 2>/dev/null | head -n 1 && docker -v 2>/dev/null) || true
echo "----------------------------------------"

if docker info >/dev/null 2>&1; then
  echo -e "${check} Docker está rodando."
else
  report_issue "Docker não está rodando. Inicie o Docker Desktop/daemon."
fi

if [ -f .env ]; then
  echo -e "${check} .env encontrado."

  if grep -Eq '^DATABASE_URL=' .env; then
    echo -e "${check} DATABASE_URL presente no .env."
  else
    report_issue "DATABASE_URL ausente no .env."
  fi

  if grep -Eq '^API_PORT=3000$' .env; then
    echo -e "${check} API_PORT padronizada em 3000."
  else
    echo -e "${warn} API_PORT não está explícita como 3000 no .env."
  fi

  if grep -Eq '^PORT=3010$' .env; then
    echo -e "${check} PORT (WEB) padronizada em 3010."
  else
    echo -e "${warn} PORT (WEB) não está explícita como 3010 no .env."
  fi

  if grep -Eq '^CORS_ORIGINS=.*3010' .env; then
    echo -e "${check} CORS_ORIGINS alinhado com porta 3010."
  else
    echo -e "${warn} CORS_ORIGINS não menciona 3010 no .env."
  fi
else
  report_issue ".env não encontrado (o script não cria/edita automaticamente)."
fi

echo -e "${info} Validando Prisma..."
if pnpm prisma validate >/dev/null 2>&1; then
  echo -e "${check} Prisma schema válido."
else
  report_issue "Prisma validate falhou (schema inválido ou conexão indisponível)."
fi

for f in scripts/api.sh scripts/backup-db.sh scripts/dev-full.sh; do
  if [ -f "$f" ]; then
    if [ -x "$f" ]; then
      echo -e "${check} $f disponível e executável."
    else
      echo -e "${warn} $f existe, mas sem permissão de execução."
    fi
  else
    report_issue "$f não encontrado."
  fi
done

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo "----------------------------------------"
if [ "$issues" -gt 0 ]; then
  echo -e "${red}❌ Diagnóstico concluiu com ${issues} problema(s) em ${ELAPSED}s.${reset}"
  echo -e "${info} Corrija os itens acima e execute novamente: pnpm dev:doctor"
  exit 1
fi

echo -e "${green}✅ Diagnóstico concluído sem problemas em ${ELAPSED}s.${reset}"
echo -e "${info} Próximo passo: pnpm dev"
