-- Restore WhatsApp dispatch/tracking columns that are required by the current Prisma schema
-- and runtime dispatcher code.
ALTER TABLE "WhatsAppMessage"
  ADD COLUMN IF NOT EXISTS "provider" TEXT,
  ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "errorCode" TEXT,
  ADD COLUMN IF NOT EXISTS "errorMessage" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockedBy" TEXT;

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_orgId_status_lockedAt_createdAt_idx"
  ON "WhatsAppMessage"("orgId", "status", "lockedAt", "createdAt");
