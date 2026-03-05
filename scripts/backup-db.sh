#!/usr/bin/env bash
# ============================================================
# NexoGestao — Backup Automático do Banco de Dados
# ============================================================
# Uso:
#   ./scripts/backup-db.sh                    # backup local
#   ./scripts/backup-db.sh --upload           # backup + upload S3
#   ./scripts/backup-db.sh --container nexogestao_postgres_prod
#
# Cron job (diário às 2h):
#   0 2 * * * /app/scripts/backup-db.sh --upload >> /var/log/nexo-backup.log 2>&1
# ============================================================
set -euo pipefail

# ─── Configuração ────────────────────────────────────────────
BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_CONTAINER="${DB_CONTAINER:-nexogestao_postgres_prod}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="nexogestao_backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"

# S3 (opcional)
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
S3_REGION="${BACKUP_S3_REGION:-sa-east-1}"
S3_PREFIX="${BACKUP_S3_PREFIX:-backups/postgres}"

# Banco
POSTGRES_USER="${POSTGRES_USER:-nexo}"
POSTGRES_DB="${POSTGRES_DB:-nexogestao}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"

# ─── Funções ─────────────────────────────────────────────────
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BACKUP] $*"; }
log_ok() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [OK] $*"; }
log_err() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [ERROR] $*" >&2; }

# ─── Verificações ────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"

log "Iniciando backup do banco: ${POSTGRES_DB}"
log "Destino: ${BACKUP_PATH}"

# ─── Executar pg_dump ────────────────────────────────────────
UPLOAD=false
for arg in "$@"; do
  [[ "$arg" == "--upload" ]] && UPLOAD=true
  [[ "$arg" == "--container" ]] && DB_CONTAINER="${2:-$DB_CONTAINER}"
done

# Verificar se estamos dentro do Docker ou rodando localmente
if command -v docker &>/dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^${DB_CONTAINER}$"; then
  log "Modo Docker: usando container ${DB_CONTAINER}"
  docker exec "${DB_CONTAINER}" \
    pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
    --no-owner --no-acl --clean --if-exists \
    | gzip -9 > "${BACKUP_PATH}"
elif command -v pg_dump &>/dev/null; then
  log "Modo local: usando pg_dump direto"
  PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump \
    -h "${POSTGRES_HOST}" \
    -p "${POSTGRES_PORT}" \
    -U "${POSTGRES_USER}" \
    -d "${POSTGRES_DB}" \
    --no-owner --no-acl --clean --if-exists \
    | gzip -9 > "${BACKUP_PATH}"
else
  log_err "pg_dump não encontrado e container Docker não está rodando"
  exit 1
fi

# ─── Verificar tamanho ───────────────────────────────────────
BACKUP_SIZE=$(du -sh "${BACKUP_PATH}" | cut -f1)
log_ok "Backup criado: ${BACKUP_FILE} (${BACKUP_SIZE})"

# ─── Checksum ────────────────────────────────────────────────
sha256sum "${BACKUP_PATH}" > "${BACKUP_PATH}.sha256"
log_ok "Checksum: $(cat "${BACKUP_PATH}.sha256")"

# ─── Upload para S3 (opcional) ───────────────────────────────
if [[ "$UPLOAD" == "true" && -n "$S3_BUCKET" ]]; then
  log "Enviando para S3: s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}"

  if command -v aws &>/dev/null; then
    aws s3 cp "${BACKUP_PATH}" "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}" \
      --region "${S3_REGION}" \
      --storage-class STANDARD_IA
    aws s3 cp "${BACKUP_PATH}.sha256" "s3://${S3_BUCKET}/${S3_PREFIX}/${BACKUP_FILE}.sha256" \
      --region "${S3_REGION}"
    log_ok "Upload S3 concluído"
  else
    log_err "AWS CLI não encontrado — upload S3 ignorado"
  fi
elif [[ "$UPLOAD" == "true" && -z "$S3_BUCKET" ]]; then
  log "BACKUP_S3_BUCKET não configurado — upload S3 ignorado"
fi

# ─── Limpeza de backups antigos ──────────────────────────────
log "Removendo backups com mais de ${RETENTION_DAYS} dias..."
find "${BACKUP_DIR}" -name "nexogestao_backup_*.sql.gz" -mtime "+${RETENTION_DAYS}" -delete
find "${BACKUP_DIR}" -name "nexogestao_backup_*.sha256" -mtime "+${RETENTION_DAYS}" -delete
REMAINING=$(find "${BACKUP_DIR}" -name "nexogestao_backup_*.sql.gz" | wc -l)
log_ok "Backups restantes: ${REMAINING}"

# ─── Resumo ──────────────────────────────────────────────────
log_ok "Backup concluído com sucesso!"
log_ok "Arquivo: ${BACKUP_PATH}"
log_ok "Tamanho: ${BACKUP_SIZE}"
log_ok "Retenção: ${RETENTION_DAYS} dias"
