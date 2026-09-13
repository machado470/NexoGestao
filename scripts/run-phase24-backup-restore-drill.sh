#!/usr/bin/env bash
set -euo pipefail
umask 077

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -p nexogestao-phase24-recovery -f "$ROOT/docker-compose.phase24-recovery-test.yml")
ARTIFACT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/nexogestao-phase24.XXXXXX")"
export DATABASE_URL='postgresql://phase24:phase24-local-only@127.0.0.1:55424/phase24_recovery?schema=public'
export POSTGRES_USER=phase24 POSTGRES_PASSWORD=phase24-local-only POSTGRES_DB=phase24_recovery
export POSTGRES_HOST=127.0.0.1 POSTGRES_PORT=55424 NODE_ENV=test

cleanup() {
  local rc=$?
  "${COMPOSE[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
  rm -rf -- "$ARTIFACT_DIR"
  exit "$rc"
}
trap cleanup EXIT INT TERM
die() { echo "phase24_drill_failed: $*" >&2; exit 1; }

# Never trust an env variable's name: assert parsed host, port and database.
TARGET="$(node -e 'const u=new URL(process.env.DATABASE_URL); console.log(`${u.hostname}|${u.port}|${u.pathname.slice(1)}`)')"
[[ "$TARGET" == '127.0.0.1|55424|phase24_recovery' ]] || die "DATABASE_URL is not the dedicated Phase 2.4 target"
command -v docker >/dev/null || die "Docker is required"
docker compose version >/dev/null || die "Docker Compose v2 is required"

"${COMPOSE[@]}" up -d --wait
DB_CONTAINER="$("${COMPOSE[@]}" ps -q postgres-phase24)"
[[ -n "$DB_CONTAINER" ]] || die "dedicated PostgreSQL container was not created"
docker port "$DB_CONTAINER" 5432/tcp | grep -Fxq '127.0.0.1:55424' || die "unexpected PostgreSQL port binding"

cd "$ROOT"
pnpm exec prisma migrate deploy --schema prisma/schema.prisma
docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U phase24 -d phase24_recovery <<'SQL'
INSERT INTO "Organization" (id,name,slug,"requiresOnboarding",timezone,currency,"createdAt") VALUES
 ('24000000-0000-4000-8000-000000000001','Phase 24 Recovery','phase24-recovery',false,'UTC','BRL','2026-09-13T10:00:00Z');
INSERT INTO "Customer" (id,"orgId",name,phone,email,active,"createdAt","updatedAt") VALUES
 ('24000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000001','Fixture Customer','+550000000024','phase24@example.invalid',true,'2026-09-13T10:01:00Z','2026-09-13T10:01:00Z');
INSERT INTO "Appointment" (id,"orgId","customerId","startsAt","endsAt",status,notes,"createdAt","updatedAt") VALUES
 ('24000000-0000-4000-8000-000000000003','24000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000002','2026-09-14T12:00:00Z','2026-09-14T13:00:00Z','CONFIRMED','phase24 fixture','2026-09-13T10:02:00Z','2026-09-13T10:02:00Z');
INSERT INTO "ServiceOrder" (id,"orgId","customerId","appointmentId",title,status,priority,"amountCents","createdAt","updatedAt") VALUES
 ('24000000-0000-4000-8000-000000000004','24000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000003','Recovery service','DONE',1,12345,'2026-09-13T10:03:00Z','2026-09-13T10:03:00Z');
INSERT INTO "Charge" (id,"orgId","customerId","serviceOrderId","amountCents",currency,status,"dueDate","paidAt","createdAt","updatedAt") VALUES
 ('24000000-0000-4000-8000-000000000005','24000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000002','24000000-0000-4000-8000-000000000004',12345,'BRL','PAID','2026-09-20T00:00:00Z','2026-09-13T10:04:00Z','2026-09-13T10:04:00Z','2026-09-13T10:04:00Z');
INSERT INTO "Payment" (id,"orgId","chargeId","amountCents",method,"paidAt",notes,"createdAt") VALUES
 ('24000000-0000-4000-8000-000000000006','24000000-0000-4000-8000-000000000001','24000000-0000-4000-8000-000000000005',12345,'PIX','2026-09-13T10:04:00Z','phase24 proof','2026-09-13T10:04:00Z');
SQL

BACKUP_DIR="$ARTIFACT_DIR" DB_CONTAINER="$DB_CONTAINER" "$ROOT/scripts/backup-db.sh"
BACKUP_FILE="$(find "$ARTIFACT_DIR" -maxdepth 1 -name 'nexogestao_backup_*.sql.gz' -print -quit)"
[[ -s "$BACKUP_FILE" ]] || die "canonical backup artifact is absent"
gzip -t "$BACKUP_FILE"
(cd "$ARTIFACT_DIR" && sha256sum -c "$(basename "$BACKUP_FILE").sha256")

docker exec "$DB_CONTAINER" dropdb -U phase24 phase24_recovery
docker exec "$DB_CONTAINER" createdb -U phase24 phase24_recovery
ALLOW_NON_PRODUCTION_RESTORE=yes DB_CONTAINER="$DB_CONTAINER" "$ROOT/scripts/restore-db.sh" --non-interactive "$BACKUP_FILE"
pnpm exec prisma migrate deploy --schema prisma/schema.prisma

PROOF="$(docker exec "$DB_CONTAINER" psql -U phase24 -d phase24_recovery -Atqc \
  'SELECT o.slug||\|'||c.phone||\|'||a.status||\|'||s."amountCents"||\|'||ch."amountCents"||\|'||p.method||\|'||p."amountCents" FROM "Organization" o JOIN "Customer" c ON c."orgId"=o.id JOIN "Appointment" a ON a."customerId"=c.id JOIN "ServiceOrder" s ON s."appointmentId"=a.id JOIN "Charge" ch ON ch."serviceOrderId"=s.id JOIN "Payment" p ON p."chargeId"=ch.id WHERE o.id='"'"'24000000-0000-4000-8000-000000000001'"'"';')"
[[ "$PROOF" == 'phase24-recovery|+550000000024|CONFIRMED|12345|12345|PIX|12345' ]] || die "relational fixture mismatch: $PROOF"
docker exec "$DB_CONTAINER" psql -U phase24 -d phase24_recovery -v ON_ERROR_STOP=1 -Atqc \
  'INSERT INTO "Customer" (id,"orgId",name,phone,active,"createdAt","updatedAt") VALUES ('"'"'24000000-0000-4000-8000-000000000099'"'"','"'"'24000000-0000-4000-8000-000000000001'"'"','"'"'Schema smoke'"'"','"'"'+550000000099'"'"',true,now(),now()); SELECT count(*) FROM "Customer" WHERE "orgId"='"'"'24000000-0000-4000-8000-000000000001'"'"';' | grep -qx 2
echo 'phase24_drill_completed: backup, integrity, restore, relational fixture and schema usability proved'
