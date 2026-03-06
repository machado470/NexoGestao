-- Automation Engine
CREATE TYPE "AutomationTrigger" AS ENUM (
  'SERVICE_ORDER_COMPLETED',
  'PAYMENT_OVERDUE',
  'APPOINTMENT_CREATED'
);

CREATE TYPE "AutomationExecutionStatus" AS ENUM (
  'PENDING',
  'SKIPPED',
  'SUCCESS',
  'FAILED'
);

CREATE TYPE "AutomationActionType" AS ENUM (
  'SEND_WHATSAPP_MESSAGE',
  'CREATE_CHARGE',
  'CREATE_NOTIFICATION',
  'UPDATE_RISK'
);

CREATE TABLE "AutomationRule" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "trigger" "AutomationTrigger" NOT NULL,
  "conditionSet" JSONB,
  "actionSet" JSONB NOT NULL,
  "createdByUserId" TEXT,
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationExecution" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "ruleId" TEXT NOT NULL,
  "trigger" "AutomationTrigger" NOT NULL,
  "status" "AutomationExecutionStatus" NOT NULL DEFAULT 'PENDING',
  "eventPayload" JSONB NOT NULL,
  "resultPayload" JSONB,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationExecution_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AutomationRule_orgId_active_trigger_createdAt_idx" ON "AutomationRule"("orgId", "active", "trigger", "createdAt");
CREATE INDEX "AutomationRule_orgId_trigger_createdAt_idx" ON "AutomationRule"("orgId", "trigger", "createdAt");

CREATE INDEX "AutomationExecution_orgId_createdAt_idx" ON "AutomationExecution"("orgId", "createdAt");
CREATE INDEX "AutomationExecution_orgId_trigger_status_createdAt_idx" ON "AutomationExecution"("orgId", "trigger", "status", "createdAt");
CREATE INDEX "AutomationExecution_ruleId_createdAt_idx" ON "AutomationExecution"("ruleId", "createdAt");

ALTER TABLE "AutomationRule"
  ADD CONSTRAINT "AutomationRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AutomationExecution"
  ADD CONSTRAINT "AutomationExecution_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AutomationExecution"
  ADD CONSTRAINT "AutomationExecution_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
