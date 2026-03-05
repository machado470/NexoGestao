-- Migration: SaaS Billing Stripe + Analytics
-- Adiciona campos Stripe à Subscription, stripeEventId ao BillingEvent, UsageMetric e FREE ao PlanName

-- Adicionar FREE ao enum PlanName
ALTER TYPE "PlanName" ADD VALUE IF NOT EXISTS 'FREE';

-- Adicionar campos Stripe ao modelo Subscription
ALTER TABLE "Subscription"
  ADD COLUMN IF NOT EXISTS "stripeCustomerId"        TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "stripeSubscriptionId"    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "stripeCheckoutSessionId" TEXT,
  ADD COLUMN IF NOT EXISTS "stripePriceId"           TEXT;

-- Índices para campos Stripe na Subscription
CREATE INDEX IF NOT EXISTS "Subscription_stripeCustomerId_idx"     ON "Subscription"("stripeCustomerId");
CREATE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_idx" ON "Subscription"("stripeSubscriptionId");

-- Adicionar stripeEventId ao BillingEvent
ALTER TABLE "BillingEvent"
  ADD COLUMN IF NOT EXISTS "stripeEventId" TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS "metadata"      JSONB;

CREATE INDEX IF NOT EXISTS "BillingEvent_stripeEventId_idx" ON "BillingEvent"("stripeEventId");

-- Adicionar updatedAt à Organization (se não existir)
ALTER TABLE "Organization"
  ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Criar enum UsageMetricEvent
DO $$ BEGIN
  CREATE TYPE "UsageMetricEvent" AS ENUM (
    'LOGIN',
    'CREATE_CUSTOMER',
    'CREATE_SERVICE_ORDER',
    'CREATE_CHARGE',
    'REGISTER_PAYMENT',
    'CREATE_EXPENSE',
    'ISSUE_INVOICE',
    'VIEW_DASHBOARD',
    'CREATE_APPOINTMENT',
    'CREATE_PERSON',
    'UPGRADE_PLAN',
    'CANCEL_SUBSCRIPTION'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar tabela UsageMetric
CREATE TABLE IF NOT EXISTS "UsageMetric" (
  "id"        TEXT NOT NULL,
  "orgId"     TEXT NOT NULL,
  "userId"    TEXT,
  "event"     "UsageMetricEvent" NOT NULL,
  "metadata"  JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UsageMetric_pkey" PRIMARY KEY ("id")
);

-- Foreign key para Organization
ALTER TABLE "UsageMetric"
  ADD CONSTRAINT "UsageMetric_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- Índices para UsageMetric
CREATE INDEX IF NOT EXISTS "UsageMetric_orgId_event_createdAt_idx" ON "UsageMetric"("orgId", "event", "createdAt");
CREATE INDEX IF NOT EXISTS "UsageMetric_orgId_createdAt_idx"       ON "UsageMetric"("orgId", "createdAt");
CREATE INDEX IF NOT EXISTS "UsageMetric_userId_event_createdAt_idx" ON "UsageMetric"("userId", "event", "createdAt");
CREATE INDEX IF NOT EXISTS "UsageMetric_event_createdAt_idx"        ON "UsageMetric"("event", "createdAt");
