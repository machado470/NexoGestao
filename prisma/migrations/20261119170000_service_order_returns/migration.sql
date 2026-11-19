-- CreateTable
CREATE TABLE "ServiceOrderReturn" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "originalOrderId" TEXT NOT NULL,
    "childOrderId" TEXT NOT NULL,
    "entryKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "originalTitle" TEXT NOT NULL,
    "sourceAcceptanceId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceOrderReturn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrderReturn_childOrderId_key" ON "ServiceOrderReturn"("childOrderId");

-- CreateIndex
CREATE INDEX "ServiceOrderReturn_orgId_originalOrderId_createdAt_idx" ON "ServiceOrderReturn"("orgId", "originalOrderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrderReturn_childOrderId_orgId_key" ON "ServiceOrderReturn"("childOrderId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrderReturn_orgId_originalOrderId_entryKey_key" ON "ServiceOrderReturn"("orgId", "originalOrderId", "entryKey");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrderAcceptance_id_orgId_serviceOrderId_key" ON "ServiceOrderAcceptance"("id", "orgId", "serviceOrderId");

-- AddForeignKey
ALTER TABLE "ServiceOrderReturn" ADD CONSTRAINT "ServiceOrderReturn_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderReturn" ADD CONSTRAINT "ServiceOrderReturn_originalOrderId_orgId_fkey" FOREIGN KEY ("originalOrderId", "orgId") REFERENCES "ServiceOrder"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderReturn" ADD CONSTRAINT "ServiceOrderReturn_childOrderId_orgId_fkey" FOREIGN KEY ("childOrderId", "orgId") REFERENCES "ServiceOrder"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrderReturn" ADD CONSTRAINT "ServiceOrderReturn_sourceAcceptanceId_orgId_originalOrderI_fkey" FOREIGN KEY ("sourceAcceptanceId", "orgId", "originalOrderId") REFERENCES "ServiceOrderAcceptance"("id", "orgId", "serviceOrderId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServiceOrderReturn" ADD CONSTRAINT "ServiceOrderReturn_content" CHECK (length(trim("title")) BETWEEN 3 AND 140 AND length(trim("reason")) BETWEEN 10 AND 2000 AND "kind" IN ('WARRANTY', 'REWORK') AND "originalOrderId" <> "childOrderId");
