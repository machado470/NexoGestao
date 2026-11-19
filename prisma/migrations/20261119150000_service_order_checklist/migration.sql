CREATE TABLE "ServiceOrderChecklistItem" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "serviceOrderId" TEXT NOT NULL,
  "entryKey" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "completed" BOOLEAN NOT NULL DEFAULT false,
  "completedAt" TIMESTAMP(3),
  "completedByName" TEXT,
  "createdByUserId" TEXT NOT NULL,
  "lastChangedByUserId" TEXT,
  "lastReason" TEXT,
  "version" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ServiceOrderChecklistItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ServiceOrderChecklistItem_title_length" CHECK (length(trim("title")) BETWEEN 3 AND 160),
  CONSTRAINT "ServiceOrderChecklistItem_version" CHECK ("version" >= 0),
  CONSTRAINT "ServiceOrderChecklistItem_completion" CHECK (
    ("completed" AND "completedAt" IS NOT NULL AND "completedByName" IS NOT NULL) OR
    (NOT "completed" AND "completedAt" IS NULL AND "completedByName" IS NULL)
  )
);
CREATE UNIQUE INDEX "ServiceOrderChecklistItem_orgId_serviceOrderId_entryKey_key" ON "ServiceOrderChecklistItem"("orgId", "serviceOrderId", "entryKey");
CREATE INDEX "ServiceOrderChecklistItem_orgId_serviceOrderId_createdAt_idx" ON "ServiceOrderChecklistItem"("orgId", "serviceOrderId", "createdAt");
ALTER TABLE "ServiceOrderChecklistItem" ADD CONSTRAINT "ServiceOrderChecklistItem_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ServiceOrderChecklistItem" ADD CONSTRAINT "ServiceOrderChecklistItem_serviceOrderId_orgId_fkey" FOREIGN KEY ("serviceOrderId", "orgId") REFERENCES "ServiceOrder"("id", "orgId") ON DELETE CASCADE ON UPDATE CASCADE;
