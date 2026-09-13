-- A signed provider account, rather than request-controlled tenant metadata,
-- is the authority for inbound WhatsApp tenant correlation.
CREATE TABLE "WhatsAppProviderAccount" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "accountId" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WhatsAppProviderAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WhatsAppProviderAccount_provider_accountId_key"
  ON "WhatsAppProviderAccount"("provider", "accountId");
CREATE INDEX "WhatsAppProviderAccount_orgId_active_idx"
  ON "WhatsAppProviderAccount"("orgId", "active");
ALTER TABLE "WhatsAppProviderAccount" ADD CONSTRAINT "WhatsAppProviderAccount_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP INDEX IF EXISTS "WhatsAppMessage_providerMessageId_key";
CREATE UNIQUE INDEX "WhatsAppMessage_orgId_provider_providerMessageId_key"
  ON "WhatsAppMessage"("orgId", "provider", "providerMessageId");
