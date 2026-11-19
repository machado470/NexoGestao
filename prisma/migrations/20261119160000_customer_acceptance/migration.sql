CREATE TABLE "ServiceOrderAcceptance" (
 "id" TEXT NOT NULL, "orgId" TEXT NOT NULL, "serviceOrderId" TEXT NOT NULL,
 "entryKey" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "publicTitle" TEXT NOT NULL,
 "publicSummary" TEXT NOT NULL, "companyName" TEXT NOT NULL, "orderVersion" TIMESTAMP(3) NOT NULL,
 "createdByUserId" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "expiresAt" TIMESTAMP(3) NOT NULL, "revokedAt" TIMESTAMP(3), "decision" TEXT,
 "responseKey" TEXT, "respondentName" TEXT, "responseNote" TEXT, "respondedAt" TIMESTAMP(3),
 CONSTRAINT "ServiceOrderAcceptance_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ServiceOrderAcceptance_summary" CHECK (length(trim("publicTitle")) BETWEEN 3 AND 160 AND length(trim("publicSummary")) BETWEEN 10 AND 1000),
 CONSTRAINT "ServiceOrderAcceptance_expiry" CHECK ("expiresAt" > "createdAt"),
 CONSTRAINT "ServiceOrderAcceptance_response" CHECK (
  ("decision" IS NULL AND "responseKey" IS NULL AND "respondentName" IS NULL AND "responseNote" IS NULL AND "respondedAt" IS NULL) OR
  ("decision" IS NOT NULL AND "decision" IN ('ACCEPTED','ISSUE') AND "responseKey" IS NOT NULL AND "respondentName" IS NOT NULL AND length(trim("respondentName")) BETWEEN 2 AND 120 AND "respondedAt" IS NOT NULL AND ("decision" <> 'ISSUE' OR length(trim(coalesce("responseNote",''))) >= 10))
 )
);
CREATE UNIQUE INDEX "ServiceOrderAcceptance_tokenHash_key" ON "ServiceOrderAcceptance"("tokenHash");
CREATE UNIQUE INDEX "ServiceOrderAcceptance_orgId_serviceOrderId_entryKey_key" ON "ServiceOrderAcceptance"("orgId", "serviceOrderId", "entryKey");
CREATE INDEX "ServiceOrderAcceptance_orgId_serviceOrderId_createdAt_idx" ON "ServiceOrderAcceptance"("orgId", "serviceOrderId", "createdAt");
ALTER TABLE "ServiceOrderAcceptance" ADD CONSTRAINT "ServiceOrderAcceptance_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOrderAcceptance" ADD CONSTRAINT "ServiceOrderAcceptance_serviceOrderId_orgId_fkey" FOREIGN KEY ("serviceOrderId", "orgId") REFERENCES "ServiceOrder"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;
