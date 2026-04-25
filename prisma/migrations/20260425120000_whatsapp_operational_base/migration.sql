-- Enums
ALTER TYPE "WhatsAppMessageStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "WhatsAppMessageStatus" ADD VALUE IF NOT EXISTS 'READ';

ALTER TYPE "WhatsAppEntityType" ADD VALUE IF NOT EXISTS 'CUSTOMER';
ALTER TYPE "WhatsAppEntityType" ADD VALUE IF NOT EXISTS 'PAYMENT';
ALTER TYPE "WhatsAppEntityType" ADD VALUE IF NOT EXISTS 'GENERAL';

ALTER TYPE "WhatsAppMessageType" ADD VALUE IF NOT EXISTS 'APPOINTMENT_REMINDER';
ALTER TYPE "WhatsAppMessageType" ADD VALUE IF NOT EXISTS 'SERVICE_UPDATE';
ALTER TYPE "WhatsAppMessageType" ADD VALUE IF NOT EXISTS 'PAYMENT_CONFIRMATION';
ALTER TYPE "WhatsAppMessageType" ADD VALUE IF NOT EXISTS 'CUSTOMER_NOTIFICATION';
ALTER TYPE "WhatsAppMessageType" ADD VALUE IF NOT EXISTS 'MANUAL';

CREATE TYPE "WhatsAppConversationStatus" AS ENUM ('OPEN', 'PENDING', 'RESOLVED', 'FAILED');
CREATE TYPE "WhatsAppConversationPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'CRITICAL');
CREATE TYPE "WhatsAppContextType" AS ENUM ('CUSTOMER', 'APPOINTMENT', 'SERVICE_ORDER', 'CHARGE', 'PAYMENT', 'GENERAL');
CREATE TYPE "WhatsAppDirection" AS ENUM ('INBOUND', 'OUTBOUND');
CREATE TYPE "WhatsAppWebhookStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED');

-- New tables
CREATE TABLE "WhatsAppConversation" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "customerId" TEXT,
  "phone" TEXT NOT NULL,
  "title" TEXT,
  "status" "WhatsAppConversationStatus" NOT NULL DEFAULT 'OPEN',
  "priority" "WhatsAppConversationPriority" NOT NULL DEFAULT 'NORMAL',
  "contextType" "WhatsAppContextType" NOT NULL DEFAULT 'GENERAL',
  "contextId" TEXT,
  "lastMessageAt" TIMESTAMP(3),
  "lastInboundAt" TIMESTAMP(3),
  "lastOutboundAt" TIMESTAMP(3),
  "unreadCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppConversation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WhatsAppWebhookEvent" (
  "id" TEXT NOT NULL,
  "orgId" TEXT,
  "provider" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "processedAt" TIMESTAMP(3),
  "status" "WhatsAppWebhookStatus" NOT NULL DEFAULT 'RECEIVED',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- Existing table evolution
ALTER TABLE "WhatsAppTemplate"
  ADD COLUMN IF NOT EXISTS "messageType" "WhatsAppMessageType",
  ADD COLUMN IF NOT EXISTS "content" TEXT;

UPDATE "WhatsAppTemplate" SET "content" = "body" WHERE "content" IS NULL;

ALTER TABLE "WhatsAppMessage"
  ADD COLUMN IF NOT EXISTS "conversationId" TEXT,
  ADD COLUMN IF NOT EXISTS "direction" "WhatsAppDirection" NOT NULL DEFAULT 'OUTBOUND',
  ADD COLUMN IF NOT EXISTS "fromPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "content" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB,
  ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "WhatsAppMessage" SET "content" = "renderedText" WHERE "content" IS NULL;
UPDATE "WhatsAppMessage" SET "sentAt" = "createdAt" WHERE "status" = 'SENT' AND "sentAt" IS NULL;
UPDATE "WhatsAppMessage" SET "failedAt" = "createdAt" WHERE "status" = 'FAILED' AND "failedAt" IS NULL;

ALTER TABLE "WhatsAppMessage" ALTER COLUMN "messageKey" DROP NOT NULL;
ALTER TABLE "WhatsAppMessage" ALTER COLUMN "customerId" DROP NOT NULL;

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppTemplate_orgId_key_key" ON "WhatsAppTemplate"("orgId", "key");
CREATE INDEX IF NOT EXISTS "WhatsAppTemplate_orgId_isActive_idx" ON "WhatsAppTemplate"("orgId", "isActive");

CREATE INDEX IF NOT EXISTS "WhatsAppConversation_orgId_customerId_idx" ON "WhatsAppConversation"("orgId", "customerId");
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_orgId_status_idx" ON "WhatsAppConversation"("orgId", "status");
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_orgId_contextType_contextId_idx" ON "WhatsAppConversation"("orgId", "contextType", "contextId");
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_orgId_lastMessageAt_idx" ON "WhatsAppConversation"("orgId", "lastMessageAt");
CREATE INDEX IF NOT EXISTS "WhatsAppConversation_orgId_priority_unreadCount_lastMessageAt_idx" ON "WhatsAppConversation"("orgId", "priority", "unreadCount", "lastMessageAt");

CREATE INDEX IF NOT EXISTS "WhatsAppMessage_orgId_customerId_createdAt_idx" ON "WhatsAppMessage"("orgId", "customerId", "createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_orgId_conversationId_createdAt_idx" ON "WhatsAppMessage"("orgId", "conversationId", "createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_orgId_entityType_entityId_createdAt_idx" ON "WhatsAppMessage"("orgId", "entityType", "entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_orgId_messageType_createdAt_idx" ON "WhatsAppMessage"("orgId", "messageType", "createdAt");

CREATE INDEX IF NOT EXISTS "WhatsAppWebhookEvent_provider_createdAt_idx" ON "WhatsAppWebhookEvent"("provider", "createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppWebhookEvent_orgId_status_createdAt_idx" ON "WhatsAppWebhookEvent"("orgId", "status", "createdAt");

-- FKs
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "WhatsAppConversation" ADD CONSTRAINT "WhatsAppConversation_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WhatsAppWebhookEvent" ADD CONSTRAINT "WhatsAppWebhookEvent_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_conversationId_fkey"
  FOREIGN KEY ("conversationId") REFERENCES "WhatsAppConversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
