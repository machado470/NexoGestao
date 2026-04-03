-- AlterTable
ALTER TABLE "WhatsAppMessage" ADD COLUMN     "errorCode" TEXT,
ADD COLUMN     "errorMessage" TEXT,
ADD COLUMN     "provider" TEXT,
ADD COLUMN     "providerMessageId" TEXT;

-- CreateTable
CREATE TABLE "ServiceOrderAttachment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'image/jpeg',
    "size" INTEGER,
    "uploadedByPersonId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrderAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceOrderAttachment_orgId_serviceOrderId_createdAt_idx" ON "ServiceOrderAttachment"("orgId", "serviceOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrderAttachment_serviceOrderId_createdAt_idx" ON "ServiceOrderAttachment"("serviceOrderId", "createdAt");

-- AddForeignKey
ALTER TABLE "ServiceOrderAttachment" ADD CONSTRAINT "ServiceOrderAttachment_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderAttachment" ADD CONSTRAINT "ServiceOrderAttachment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
