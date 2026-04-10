-- Wave 6 commercial readiness
ALTER TABLE "Plan"
  ADD COLUMN IF NOT EXISTS "displayName" TEXT,
  ADD COLUMN IF NOT EXISTS "limitsJson" JSONB,
  ADD COLUMN IF NOT EXISTS "featuresJson" JSONB;

UPDATE "Plan"
SET "displayName" = CASE "name"
  WHEN 'FREE' THEN 'Free'
  WHEN 'STARTER' THEN 'Basic'
  WHEN 'PRO' THEN 'Pro'
  WHEN 'BUSINESS' THEN 'Enterprise'
  ELSE "name"::text
END
WHERE "displayName" IS NULL;

ALTER TABLE "Plan"
  ALTER COLUMN "displayName" SET NOT NULL;

ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "billingProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "billingCustomerRef" TEXT,
  ADD COLUMN IF NOT EXISTS "billingExternalRef" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t WHERE t.typname = 'BillingProvider'
  ) THEN
    CREATE TYPE "BillingProvider" AS ENUM ('STRIPE', 'MERCADO_PAGO', 'PAGARME', 'MANUAL');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t WHERE t.typname = 'SubscriptionStatus' AND EXISTS (
      SELECT 1
      FROM pg_enum e
      JOIN pg_type t2 ON t2.oid = e.enumtypid
      WHERE t2.typname = 'SubscriptionStatus' AND e.enumlabel = 'SUSPENDED'
    )
  ) THEN
    ALTER TYPE "SubscriptionStatus" ADD VALUE 'SUSPENDED';
  END IF;
END $$;

ALTER TABLE "Subscription"
  ALTER COLUMN "billingProvider" TYPE "BillingProvider"
  USING CASE
    WHEN "billingProvider" IS NULL THEN NULL
    ELSE "billingProvider"::"BillingProvider"
  END;

CREATE TABLE IF NOT EXISTS "TenantFeatureOverride" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "featureKey" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TenantFeatureOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantFeatureOverride_orgId_featureKey_key"
  ON "TenantFeatureOverride"("orgId", "featureKey");

CREATE INDEX IF NOT EXISTS "TenantFeatureOverride_orgId_enabled_idx"
  ON "TenantFeatureOverride"("orgId", "enabled");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TenantFeatureOverride_orgId_fkey'
  ) THEN
    ALTER TABLE "TenantFeatureOverride"
      ADD CONSTRAINT "TenantFeatureOverride_orgId_fkey"
      FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
