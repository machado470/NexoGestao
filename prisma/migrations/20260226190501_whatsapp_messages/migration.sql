-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP');

-- CreateEnum
CREATE TYPE "WhatsAppMessageStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "WhatsAppEntityType" AS ENUM ('APPOINTMENT', 'SERVICE_ORDER', 'CHARGE');

-- CreateEnum
CREATE TYPE "WhatsAppMessageType" AS ENUM ('APPOINTMENT_CONFIRMATION', 'REMIND_24H', 'PAYMENT_LINK', 'PAYMENT_REMINDER', 'RECEIPT', 'EXECUTION_CONFIRMATION');

-- CreateTable
CREATE TABLE "WhatsAppTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WhatsAppTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',
    "entityType" "WhatsAppEntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "messageType" "WhatsAppMessageType" NOT NULL,
    "messageKey" TEXT NOT NULL,
    "status" "WhatsAppMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "toPhone" TEXT NOT NULL,
    "templateKey" TEXT,
    "renderedText" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'mock',
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "metadata" JSONB,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_orgId_channel_isActive_idx" ON "WhatsAppTemplate"("orgId", "channel", "isActive");

-- CreateIndex
CREATE INDEX "WhatsAppTemplate_orgId_createdAt_idx" ON "WhatsAppTemplate"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppTemplate_orgId_key_key" ON "WhatsAppTemplate"("orgId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "WhatsAppMessage_messageKey_key" ON "WhatsAppMessage"("messageKey");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_orgId_status_createdAt_idx" ON "WhatsAppMessage"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_customerId_createdAt_idx" ON "WhatsAppMessage"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_orgId_messageType_createdAt_idx" ON "WhatsAppMessage"("orgId", "messageType", "createdAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_orgId_entityType_entityId_idx" ON "WhatsAppMessage"("orgId", "entityType", "entityId");

-- AddForeignKey
ALTER TABLE "WhatsAppTemplate" ADD CONSTRAINT "WhatsAppTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
