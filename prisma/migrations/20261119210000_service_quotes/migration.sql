BEGIN;

-- CreateTable
CREATE TABLE "ServiceQuote" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "entryKey" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceQuoteRevision" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "actorName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceQuoteRevision_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServiceQuoteApproval" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "quoteVersion" INTEGER NOT NULL,
    "entryKey" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "decision" TEXT,
    "responseKey" TEXT,
    "respondentName" TEXT,
    "responseNote" TEXT,
    "respondedAt" TIMESTAMP(3),

    CONSTRAINT "ServiceQuoteApproval_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServiceQuote_orgId_createdAt_id_idx" ON "ServiceQuote"("orgId", "createdAt", "id");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuote_id_orgId_key" ON "ServiceQuote"("id", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuote_orgId_entryKey_key" ON "ServiceQuote"("orgId", "entryKey");

-- CreateIndex
CREATE INDEX "ServiceQuoteRevision_orgId_quoteId_version_idx" ON "ServiceQuoteRevision"("orgId", "quoteId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuoteRevision_quoteId_version_key" ON "ServiceQuoteRevision"("quoteId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuoteRevision_quoteId_version_orgId_key" ON "ServiceQuoteRevision"("quoteId", "version", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuoteApproval_tokenHash_key" ON "ServiceQuoteApproval"("tokenHash");

-- CreateIndex
CREATE INDEX "ServiceQuoteApproval_orgId_quoteId_createdAt_idx" ON "ServiceQuoteApproval"("orgId", "quoteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuoteApproval_orgId_quoteId_entryKey_key" ON "ServiceQuoteApproval"("orgId", "quoteId", "entryKey");

-- AddForeignKey
ALTER TABLE "ServiceQuote" ADD CONSTRAINT "ServiceQuote_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuote" ADD CONSTRAINT "ServiceQuote_customerId_orgId_fkey" FOREIGN KEY ("customerId", "orgId") REFERENCES "Customer"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuoteRevision" ADD CONSTRAINT "ServiceQuoteRevision_quoteId_orgId_fkey" FOREIGN KEY ("quoteId", "orgId") REFERENCES "ServiceQuote"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuoteApproval" ADD CONSTRAINT "ServiceQuoteApproval_quoteId_orgId_fkey" FOREIGN KEY ("quoteId", "orgId") REFERENCES "ServiceQuote"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuoteApproval" ADD CONSTRAINT "ServiceQuoteApproval_quoteId_quoteVersion_orgId_fkey" FOREIGN KEY ("quoteId", "quoteVersion", "orgId") REFERENCES "ServiceQuoteRevision"("quoteId", "version", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServiceQuote" ADD CONSTRAINT "ServiceQuote_state" CHECK ("version" >= 0 AND "status" IN ('DRAFT','SHARED','ACCEPTED','REJECTED'));
ALTER TABLE "ServiceQuoteRevision" ADD CONSTRAINT "ServiceQuoteRevision_values" CHECK ("version" >= 0 AND length(trim("reason")) BETWEEN 10 AND 1000);
ALTER TABLE "ServiceQuoteApproval" ADD CONSTRAINT "ServiceQuoteApproval_response" CHECK (
 ("decision" IS NULL AND "responseKey" IS NULL AND "respondedAt" IS NULL AND "respondentName" IS NULL AND "responseNote" IS NULL)
 OR ("decision" IS NOT NULL AND "decision" IN ('ACCEPTED','REJECTED') AND "responseKey" IS NOT NULL AND "respondedAt" IS NOT NULL AND "respondentName" IS NOT NULL AND length(trim("respondentName")) BETWEEN 2 AND 120 AND ("responseNote" IS NULL OR length("responseNote") <= 1000) AND ("decision" <> 'REJECTED' OR ("responseNote" IS NOT NULL AND length(trim("responseNote")) >= 10)))
);
CREATE UNIQUE INDEX "ServiceQuoteApproval_one_pending" ON "ServiceQuoteApproval"("quoteId") WHERE "respondedAt" IS NULL AND "revokedAt" IS NULL;

COMMIT;
