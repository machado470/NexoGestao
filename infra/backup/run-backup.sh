#!/usr/bin/env bash
# ============================================================
# NexoGestão — Script de Backup com Rotação (7 dias)
# ============================================================
# Faz o dump do PostgreSQL do container, compacta e mantém
# apenas os últimos 7 backups locais.
# ============================================================
set -euo pipefail

# ─── Configuração ────────────────────────────────────────────
BACKUP_DIR="/var/backups/nexogestao"
RETENTION_DAYS=7
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="nexogestao_prod_${TIMESTAMP}.sql.gz"
CONTAINER_NAME="nexogestao_postgres_prod"
DB_USER="nexo"
DB_NAME="nexogestao"

# ─── Cores ───────────────────────────────────────────────────
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${BLUE}[backup]${NC} [$(date '+%Y-%m-%d %H:%M:%S')] $*"; }
log_ok() { echo -e "${GREEN}[backup]${NC} ✅ $*"; }
log_err() { echo -e "${RED}[backup]${NC} ❌ $*" >&2; }

# ─── Início ──────────────────────────────────────────────────
mkdir -p "$BACKUP_DIR"
log "Iniciando backup para $BACKUP_DIR/$BACKUP_FILE..."

# 1. Verificar se o container está rodando
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
  log_err "Container $CONTAINER_NAME não encontrado ou não está rodando."
  exit 1
fi

# 2. Executar pg_dump dentro do container
# Usamos -T para não alocar TTY (importante para cron)
if docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-acl --clean --if-exists | gzip -9 > "$BACKUP_DIR/$BACKUP_FILE"; then
  SIZE=$(du -sh "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)
  log_ok "Backup concluído com sucesso ($SIZE)"
else
  log_err "Falha ao gerar backup."
  exit 1
fi

# 3. Gerar Checksum
sha256sum "$BACKUP_DIR/$BACKUP_FILE" > "$BACKUP_DIR/$BACKUP_FILE.sha256"

# 4. Rotação: remover arquivos com mais de 7 dias
log "Limpando backups antigos (retenção: $RETENTION_DAYS dias)..."
find "$BACKUP_DIR" -name "nexogestao_prod_*.sql.gz*" -mtime +$RETENTION_DAYS -exec rm -f {} \;

REMAINING=$(find "$BACKUP_DIR" -name "nexogestao_prod_*.sql.gz" | wc -l)
log_ok "Rotação concluída. Backups restantes: $REMAINING"

# 5. Opcional: Upload para S3 (se AWS CLI estiver configurado)
if command -v aws >/dev/null 2>&1 && [[ -n "${BACKUP_S3_BUCKET:-}" ]]; then
  log "Enviando para S3: s3://$BACKUP_S3_BUCKET/..."
  aws s3 cp "$BACKUP_DIR/$BACKUP_FILE" "s3://$BACKUP_S3_BUCKET/backups/$BACKUP_FILE"
  log_ok "Upload S3 concluído"
fi

log_ok "Processo de backup finalizado."
