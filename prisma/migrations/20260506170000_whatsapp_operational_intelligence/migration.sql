CREATE TYPE "WhatsAppInboundIntent" AS ENUM (
  'PAYMENT_INTENT',
  'RESCHEDULE_INTENT',
  'CANCELLATION_INTENT',
  'COMPLAINT_INTENT',
  'QUOTE_REQUEST_INTENT',
  'SERVICE_STATUS_INTENT',
  'GENERAL_INTENT'
);

CREATE TYPE "WhatsAppSlaStatus" AS ENUM ('OK', 'WARNING', 'BREACHED');

CREATE TYPE "WhatsAppSuggestedAction" AS ENUM (
  'SEND_PAYMENT_LINK',
  'CONFIRM_APPOINTMENT',
  'RESCHEDULE_APPOINTMENT',
  'OPEN_SERVICE_ORDER',
  'SEND_SERVICE_UPDATE',
  'ESCALATE_TO_OPERATOR',
  'MARK_RESOLVED',
  'REPLY_WITH_TEMPLATE'
);

ALTER TABLE "WhatsAppConversation"
  ADD COLUMN "priorityReason" TEXT,
  ADD COLUMN "intent" "WhatsAppInboundIntent" NOT NULL DEFAULT 'GENERAL_INTENT',
  ADD COLUMN "intentReason" TEXT,
  ADD COLUMN "intentConfidence" DOUBLE PRECISION,
  ADD COLUMN "waitingSince" TIMESTAMP(3),
  ADD COLUMN "responseDueAt" TIMESTAMP(3),
  ADD COLUMN "slaStatus" "WhatsAppSlaStatus" NOT NULL DEFAULT 'OK',
  ADD COLUMN "suggestedActions" JSONB,
  ADD COLUMN "intelligenceExplanation" JSONB,
  ADD COLUMN "intelligenceVersion" INTEGER NOT NULL DEFAULT 1;

CREATE INDEX "WhatsAppConversation_orgId_intent_lastInboundAt_idx" ON "WhatsAppConversation"("orgId", "intent", "lastInboundAt");
CREATE INDEX "WhatsAppConversation_orgId_slaStatus_responseDueAt_idx" ON "WhatsAppConversation"("orgId", "slaStatus", "responseDueAt");
