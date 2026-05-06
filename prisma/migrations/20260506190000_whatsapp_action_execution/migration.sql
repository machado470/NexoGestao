CREATE TYPE "WhatsAppActionExecutionStatus" AS ENUM (
  'PENDING_APPROVAL',
  'APPROVED',
  'EXECUTED',
  'FAILED',
  'CANCELLED'
);

CREATE TABLE "WhatsAppActionExecution" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "suggestedAction" "WhatsAppSuggestedAction" NOT NULL,
  "status" "WhatsAppActionExecutionStatus" NOT NULL DEFAULT 'PENDING_APPROVAL',
  "approvalRequired" BOOLEAN NOT NULL DEFAULT true,
  "approvedBy" TEXT,
  "executedBy" TEXT,
  "cancelledBy" TEXT,
  "executionReason" TEXT,
  "executionResult" JSONB,
  "actionPayload" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "failureReason" TEXT,
  "approvedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "WhatsAppActionExecution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppActionExecution_orgId_idempotencyKey_key" ON "WhatsAppActionExecution"("orgId", "idempotencyKey");
CREATE INDEX "WhatsAppActionExecution_orgId_status_createdAt_idx" ON "WhatsAppActionExecution"("orgId", "status", "createdAt");
CREATE INDEX "WhatsAppActionExecution_orgId_conversationId_createdAt_idx" ON "WhatsAppActionExecution"("orgId", "conversationId", "createdAt");
CREATE INDEX "WhatsAppActionExecution_orgId_suggestedAction_status_createdAt_idx" ON "WhatsAppActionExecution"("orgId", "suggestedAction", "status", "createdAt");

ALTER TABLE "WhatsAppActionExecution"
  ADD CONSTRAINT "WhatsAppActionExecution_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WhatsAppActionExecution"
  ADD CONSTRAINT "WhatsAppActionExecution_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
