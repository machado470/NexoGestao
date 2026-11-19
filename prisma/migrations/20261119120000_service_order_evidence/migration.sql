CREATE TABLE "ServiceOrderEvidence" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "serviceOrderId" TEXT NOT NULL,
  "entryKey" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "content" BYTEA NOT NULL,
  "sha256" TEXT NOT NULL,
  "uploadedByUserId" TEXT NOT NULL,
  "uploadedByName" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceOrderEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceOrderEvidence_content_size" CHECK (octet_length("content") BETWEEN 4 AND 65536),
  CONSTRAINT "ServiceOrderEvidence_description_length" CHECK (length(trim("description")) BETWEEN 5 AND 1000)
);
CREATE UNIQUE INDEX "ServiceOrderEvidence_orgId_serviceOrderId_entryKey_key" ON "ServiceOrderEvidence"("orgId", "serviceOrderId", "entryKey");
CREATE INDEX "ServiceOrderEvidence_orgId_serviceOrderId_createdAt_idx" ON "ServiceOrderEvidence"("orgId", "serviceOrderId", "createdAt");
ALTER TABLE "ServiceOrderEvidence" ADD CONSTRAINT "ServiceOrderEvidence_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOrderEvidence" ADD CONSTRAINT "ServiceOrderEvidence_serviceOrderId_orgId_fkey" FOREIGN KEY ("serviceOrderId", "orgId") REFERENCES "ServiceOrder"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;
