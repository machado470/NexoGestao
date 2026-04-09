CREATE TABLE "IdempotencyRecord" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "scope" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PROCESSING',
  "response" JSONB,
  "errorCode" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdempotencyRecord_orgId_scope_key_key"
  ON "IdempotencyRecord"("orgId", "scope", "key");

CREATE INDEX "IdempotencyRecord_orgId_createdAt_idx"
  ON "IdempotencyRecord"("orgId", "createdAt");
