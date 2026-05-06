ALTER TYPE "WhatsAppWebhookStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

ALTER TABLE "WhatsAppWebhookEvent"
  ADD COLUMN IF NOT EXISTS "traceId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT;

CREATE INDEX IF NOT EXISTS "WhatsAppWebhookEvent_traceId_idx" ON "WhatsAppWebhookEvent"("traceId");
CREATE INDEX IF NOT EXISTS "WhatsAppWebhookEvent_providerMessageId_idx" ON "WhatsAppWebhookEvent"("providerMessageId");
