#!/usr/bin/env bash
# ============================================================
# NexoGestao — Restore do Banco de Dados
# ============================================================
# Uso:
#   ./scripts/restore-db.sh /backups/nexogestao_backup_20260305_020000.sql.gz
# ============================================================
set -euo pipefail

BACKUP_FILE="${1:?Informe o arquivo de backup: ./scripts/restore-db.sh <arquivo.sql.gz>}"

if [[ ! -f "$BACKUP_FILE" ]]; then
  echo "[ERROR] Arquivo não encontrado: $BACKUP_FILE"
  exit 1
fi

DB_CONTAINER="${DB_CONTAINER:-nexogestao_postgres_prod}"
POSTGRES_USER="${POSTGRES_USER:-nexo}"
POSTGRES_DB="${POSTGRES_DB:-nexogestao}"

echo "[RESTORE] Arquivo: $BACKUP_FILE"
echo "[RESTORE] Banco: $POSTGRES_DB"
echo ""
echo "⚠️  ATENÇÃO: Este restore irá SUBSTITUIR todos os dados atuais!"
read -r -p "Confirma? (sim/não): " CONFIRM

if [[ "$CONFIRM" != "sim" ]]; then
  echo "[RESTORE] Operação cancelada."
  exit 0
fi

echo "[RESTORE] Iniciando restore..."

if command -v docker &>/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DB_CONTAINER}$"; then
  gunzip -c "$BACKUP_FILE" | docker exec -i "${DB_CONTAINER}" \
    psql -U "${POSTGRES_USER}" -d "${POSTGRES_DB}"
else
  gunzip -c "$BACKUP_FILE" | PGPASSWORD="${POSTGRES_PASSWORD:-}" psql \
    -h "${POSTGRES_HOST:-postgres}" \
    -p "${POSTGRES_PORT:-5432}" \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}"
fi

echo "[RESTORE] ✅ Restore concluído com sucesso!"
