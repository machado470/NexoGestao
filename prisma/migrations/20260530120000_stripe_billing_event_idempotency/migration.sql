ALTER TABLE "BillingEvent" ADD COLUMN "providerEventId" TEXT;

CREATE UNIQUE INDEX "BillingEvent_providerEventId_key" ON "BillingEvent"("providerEventId");
