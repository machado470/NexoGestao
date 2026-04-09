#!/usr/bin/env bash
set -euo pipefail

CONTAINER_NAME="nexogestao-postgres-e2e"
POSTGRES_IMAGE="postgres:15"
POSTGRES_PASSWORD="postgres"
POSTGRES_DB="nexogestao"

if ! command -v docker >/dev/null 2>&1; then
  echo "[ERROR] docker não encontrado no ambiente."
  exit 1
fi

if nc -z localhost 5432 >/dev/null 2>&1; then
  HOST_PORT=5433
else
  HOST_PORT=5432
fi

DATABASE_URL="postgresql://postgres:${POSTGRES_PASSWORD}@localhost:${HOST_PORT}/${POSTGRES_DB}?schema=public"

echo "[INFO] Porta selecionada para Postgres: ${HOST_PORT}"

if docker ps -a --format '{{.Names}}' | grep -Fxq "${CONTAINER_NAME}"; then
  echo "[INFO] Removendo container existente: ${CONTAINER_NAME}"
  docker rm -f "${CONTAINER_NAME}" >/dev/null
fi

echo "[INFO] Subindo container ${CONTAINER_NAME} (${POSTGRES_IMAGE})"
docker run -d \
  --name "${CONTAINER_NAME}" \
  -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
  -e POSTGRES_DB="${POSTGRES_DB}" \
  -p "${HOST_PORT}:5432" \
  "${POSTGRES_IMAGE}" >/dev/null

echo "[INFO] Aguardando readiness real do banco"
for _ in $(seq 1 60); do
  if docker exec "${CONTAINER_NAME}" pg_isready -U postgres -d "${POSTGRES_DB}" >/dev/null 2>&1; then
    echo "[INFO] Postgres pronto"
    break
  fi
  sleep 1
 done

if ! docker exec "${CONTAINER_NAME}" pg_isready -U postgres -d "${POSTGRES_DB}" >/dev/null 2>&1; then
  echo "[ERROR] Postgres não ficou pronto a tempo"
  docker logs "${CONTAINER_NAME}" | tail -n 50
  exit 1
fi

echo "[INFO] Rodando migrations"
DATABASE_URL="${DATABASE_URL}" pnpm --filter ./apps/api prisma migrate deploy

echo "[INFO] Rodando validação E2E execution v5"
DATABASE_URL="${DATABASE_URL}" pnpm --filter ./apps/api validate:execution:v5

echo "[INFO] Artefato esperado: apps/api/artifacts/execution-v5-e2e.json"
