-- Add logical key and executing status
ALTER TYPE "OperationalActionExecutionStatus" ADD VALUE IF NOT EXISTS 'EXECUTING';

ALTER TABLE "OperationalActionExecution"
ADD COLUMN IF NOT EXISTS "logicalKey" TEXT;

UPDATE "OperationalActionExecution"
SET "logicalKey" = CONCAT(
  "actionType", ':', "entityType", ':', "entityId", ':', COALESCE("sourceSignalId", '__NO_SIGNAL__')
)
WHERE "logicalKey" IS NULL;

ALTER TABLE "OperationalActionExecution"
ALTER COLUMN "logicalKey" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "OperationalActionExecution_orgId_logicalKey_createdAt_idx"
ON "OperationalActionExecution"("orgId", "logicalKey", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "OperationalActionExecution_unique_requested_per_key"
ON "OperationalActionExecution"("orgId", "logicalKey")
WHERE "status" = 'REQUESTED';
