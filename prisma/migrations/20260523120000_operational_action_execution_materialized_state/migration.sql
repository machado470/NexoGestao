-- CreateEnum
CREATE TYPE "OperationalActionExecutionStatus" AS ENUM ('REQUESTED', 'EXECUTED', 'FAILED', 'CANCELED');

-- CreateTable
CREATE TABLE "OperationalActionExecution" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "sourceSignalId" TEXT,
    "status" "OperationalActionExecutionStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedAt" TIMESTAMP(3) NOT NULL,
    "requestedByUserId" TEXT NOT NULL,
    "executedAt" TIMESTAMP(3),
    "executedByUserId" TEXT,
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "canceledAt" TIMESTAMP(3),
    "canceledByUserId" TEXT,
    "origin" TEXT,
    "suggestedAction" TEXT,
    "relatedChargeId" TEXT,
    "relatedServiceOrderId" TEXT,
    "relatedMessageId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperationalActionExecution_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "OperationalActionExecution" ADD CONSTRAINT "OperationalActionExecution_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "OperationalActionExecution_orgId_status_createdAt_idx" ON "OperationalActionExecution"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "OperationalActionExecution_orgId_actionType_entityId_sourceSignalId_createdAt_idx" ON "OperationalActionExecution"("orgId", "actionType", "entityId", "sourceSignalId", "createdAt");

-- CreateIndex
CREATE INDEX "OperationalActionExecution_orgId_entityType_entityId_createdAt_idx" ON "OperationalActionExecution"("orgId", "entityType", "entityId", "createdAt");
