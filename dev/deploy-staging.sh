#!/usr/bin/env bash
set -euo pipefail

# Garante que estamos no diretório raiz do projeto
cd "$(dirname "$0")/.."

log() {
  echo "[deploy-staging] $*"
}

log "Verificando pré-requisitos..."
command -v docker >/dev/null 2>&1 || { log "ERRO: docker não encontrado. Instale o Docker antes de continuar."; exit 1; }
command -v docker-compose >/dev/null 2>&1 || command -v "docker compose" >/dev/null 2>&1 || { log "ERRO: docker-compose não encontrado."; exit 1; }

log "Carregando variáveis de ambiente de .env.staging..."
if [ ! -f .env.staging ]; then
  log "ERRO: Arquivo .env.staging não encontrado. Crie um a partir de .env.staging.example."
  log "  cp .env.staging.example .env.staging"
  exit 1
fi

# Exportar variáveis do arquivo .env.staging (ignora linhas de comentário e vazias)
set -a
# shellcheck disable=SC1091
source .env.staging
set +a

log "Parando e removendo containers antigos (se existirem)..."
docker-compose -f docker-compose.staging.yml down --remove-orphans

log "Construindo as imagens Docker..."
docker-compose -f docker-compose.staging.yml build --no-cache

log "Iniciando os serviços em modo detached..."
docker-compose -f docker-compose.staging.yml up -d

log "Aguardando a API ficar saudável..."
# Aguarda com timeout de 2 minutos
end_time=$((SECONDS + 120))
while [ $SECONDS -lt $end_time ]; do
  if curl -sf "http://localhost:${API_PORT:-3001}/health" > /dev/null; then
    log "API está saudável!"
    break
  fi
  log "Aguardando a API... (${SECONDS}s)"
  sleep 5
done

if ! curl -sf "http://localhost:${API_PORT:-3001}/health" > /dev/null; then
  log "ERRO: A API não ficou saudável a tempo."
  docker-compose -f docker-compose.staging.yml logs api
  exit 1
fi

log "Executando o smoke test para validar o deploy..."
API="http://localhost:${API_PORT:-3001}" ./dev/smoke.sh

log "Deploy concluído com sucesso!"
echo ""
echo "  URL da API: http://localhost:${API_PORT:-3001}"
echo "  URL do Web: http://localhost:${WEB_PORT:-3000}"
echo ""
