#!/usr/bin/env bash
# Canonical PostgreSQL backup entrypoint. S3 is optional and never implied.
set -euo pipefail
umask 077

BACKUP_DIR="${BACKUP_DIR:-/backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DB_CONTAINER="${DB_CONTAINER:-nexogestao_postgres_prod}"
POSTGRES_USER="${POSTGRES_USER:-}"
POSTGRES_DB="${POSTGRES_DB:-}"
POSTGRES_HOST="${POSTGRES_HOST:-}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
S3_BUCKET="${BACKUP_S3_BUCKET:-}"
S3_REGION="${BACKUP_S3_REGION:-sa-east-1}"
S3_PREFIX="${BACKUP_S3_PREFIX:-backups/postgres}"
UPLOAD=false
LOCK_DIR=""
TMP_BACKUP=""
TMP_CHECKSUM=""

log() { printf 'timestamp=%s component=postgres_backup event=%s status=%s %s\n' "$(date -u +%FT%TZ)" "$1" "$2" "${3:-}"; }
die() { log backup_failed failed "reason=$(printf %q "$*")" >&2; exit 1; }
cleanup() {
  local rc=$?
  [[ -z "$TMP_BACKUP" ]] || rm -f -- "$TMP_BACKUP"
  [[ -z "$TMP_CHECKSUM" ]] || rm -f -- "$TMP_CHECKSUM"
  [[ -z "$LOCK_DIR" ]] || rmdir -- "$LOCK_DIR" 2>/dev/null || true
  exit "$rc"
}
trap cleanup EXIT INT TERM

while (($#)); do
  case "$1" in
    --upload) UPLOAD=true; shift ;;
    --container) [[ $# -ge 2 ]] || die "--container requires a value"; DB_CONTAINER="$2"; shift 2 ;;
    *) die "unknown argument: $1" ;;
  esac
done

[[ "$RETENTION_DAYS" =~ ^[0-9]+$ ]] || die "RETENTION_DAYS must be a non-negative integer"
[[ -n "$POSTGRES_USER" && -n "$POSTGRES_DB" ]] || die "POSTGRES_USER and POSTGRES_DB are required"
command -v gzip >/dev/null || die "gzip is required"
command -v sha256sum >/dev/null || die "sha256sum is required"
mkdir -p -- "$BACKUP_DIR" || die "cannot create BACKUP_DIR"
[[ -d "$BACKUP_DIR" && -w "$BACKUP_DIR" ]] || die "BACKUP_DIR is not a writable directory"
BACKUP_DIR="$(cd "$BACKUP_DIR" && pwd -P)"
LOCK_DIR="$BACKUP_DIR/.nexogestao-backup.lock"
mkdir "$LOCK_DIR" 2>/dev/null || die "another canonical backup is already running"

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
UNIQUE="${STAMP}_$$_$(printf '%04x' "$((RANDOM & 65535))")"
BACKUP_FILE="nexogestao_backup_${UNIQUE}.sql.gz"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"
CHECKSUM_PATH="$BACKUP_PATH.sha256"
TMP_BACKUP="$(mktemp "$BACKUP_DIR/.${BACKUP_FILE}.partial.XXXXXX")"
TMP_CHECKSUM="$(mktemp "$BACKUP_DIR/.${BACKUP_FILE}.sha256.partial.XXXXXX")"
log backup_started started "database=$(printf %q "$POSTGRES_DB") destination=$(printf %q "$BACKUP_PATH")"

if command -v docker >/dev/null 2>&1 && docker inspect -f '{{.State.Running}}' "$DB_CONTAINER" 2>/dev/null | grep -qx true; then
  docker exec "$DB_CONTAINER" pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    --no-owner --no-acl --clean --if-exists | gzip -9 >"$TMP_BACKUP"
else
  [[ -n "$POSTGRES_HOST" ]] || die "POSTGRES_HOST is required when DB_CONTAINER is unavailable"
  command -v pg_dump >/dev/null || die "pg_dump is required when DB_CONTAINER is unavailable"
  PGPASSWORD="${POSTGRES_PASSWORD:-}" pg_dump -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" \
    -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-acl --clean --if-exists | gzip -9 >"$TMP_BACKUP"
fi
[[ -s "$TMP_BACKUP" ]] || die "pg_dump produced an empty artifact"
gzip -t -- "$TMP_BACKUP"
log integrity_verified success "artifact=$(printf %q "$BACKUP_FILE")"
HASH="$(sha256sum "$TMP_BACKUP" | awk '{print $1}')"
printf '%s  %s\n' "$HASH" "$(basename "$TMP_BACKUP")" >"$TMP_CHECKSUM"
(cd "$BACKUP_DIR" && sha256sum -c -- "$(basename "$TMP_CHECKSUM")" >/dev/null) || die "local checksum verification failed"
printf '%s  %s\n' "$HASH" "$BACKUP_FILE" >"$TMP_CHECKSUM"
# Publish only the locally validated dump and its sidecar.
mv -- "$TMP_BACKUP" "$BACKUP_PATH"; TMP_BACKUP=""
mv -- "$TMP_CHECKSUM" "$CHECKSUM_PATH"; TMP_CHECKSUM=""
(cd "$BACKUP_DIR" && sha256sum -c -- "$(basename "$CHECKSUM_PATH")" >/dev/null) || die "published checksum verification failed"
log checksum_verified success "sha256=$HASH"
log backup_created success "result=LOCAL_BACKUP_SUCCESS artifact=$(printf %q "$BACKUP_PATH")"

find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'nexogestao_backup_*.sql.gz' -o -name 'nexogestao_backup_*.sql.gz.sha256' \) \
  -mtime "+$RETENTION_DAYS" -delete
log retention_completed success "retention_days=$RETENTION_DAYS"

if [[ "$UPLOAD" != true ]]; then
  log offsite_skipped skipped "result=OFFSITE_UPLOAD_SKIPPED reason=not_requested"
elif [[ -z "$S3_BUCKET" ]]; then
  log offsite_failed failed "result=OFFSITE_UPLOAD_FAILED reason=bucket_not_configured" >&2
  exit 2
elif ! command -v aws >/dev/null 2>&1; then
  log offsite_failed failed "result=OFFSITE_UPLOAD_FAILED reason=aws_cli_unavailable" >&2
  exit 2
elif aws s3 cp "$BACKUP_PATH" "s3://$S3_BUCKET/$S3_PREFIX/$BACKUP_FILE" --region "$S3_REGION" && \
     aws s3 cp "$CHECKSUM_PATH" "s3://$S3_BUCKET/$S3_PREFIX/$BACKUP_FILE.sha256" --region "$S3_REGION"; then
  log offsite_uploaded success "result=OFFSITE_UPLOAD_SUCCESS destination=s3://$S3_BUCKET/$S3_PREFIX/"
else
  log offsite_failed failed "result=OFFSITE_UPLOAD_FAILED reason=aws_upload_error" >&2
  exit 2
fi
