ALTER TABLE "ServiceOrder"
  ADD COLUMN IF NOT EXISTS "executionStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "executionEndedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "outcomeSummary" TEXT;

CREATE TABLE IF NOT EXISTS "Execution" (
  "id" TEXT PRIMARY KEY,
  "orgId" TEXT NOT NULL REFERENCES "Organization"("id") ON DELETE CASCADE,
  "serviceOrderId" TEXT NOT NULL REFERENCES "ServiceOrder"("id") ON DELETE CASCADE,
  "customerId" TEXT NOT NULL REFERENCES "Customer"("id") ON DELETE CASCADE,
  "executorPersonId" TEXT REFERENCES "Person"("id") ON DELETE SET NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "notes" TEXT,
  "checklist" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "attachments" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "Execution_orgId_createdAt_idx" ON "Execution"("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "Execution_serviceOrderId_createdAt_idx" ON "Execution"("serviceOrderId", "createdAt");
