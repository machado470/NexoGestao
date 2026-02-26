-- AlterEnum
ALTER TYPE "WhatsAppMessageStatus" ADD VALUE 'SENDING';

-- AlterTable
ALTER TABLE "WhatsAppMessage" ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "lockedBy" TEXT;

-- CreateIndex
CREATE INDEX "WhatsAppMessage_orgId_status_lockedAt_createdAt_idx" ON "WhatsAppMessage"("orgId", "status", "lockedAt", "createdAt");
