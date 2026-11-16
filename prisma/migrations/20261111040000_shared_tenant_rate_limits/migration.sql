CREATE TABLE "TenantRateLimitBucket" (
    "orgId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "count" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "TenantRateLimitBucket_pkey" PRIMARY KEY ("orgId", "scope")
);
CREATE INDEX "TenantRateLimitBucket_startedAt_idx" ON "TenantRateLimitBucket"("startedAt");
