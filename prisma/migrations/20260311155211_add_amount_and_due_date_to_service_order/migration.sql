-- CreateEnum
CREATE TYPE "UsageMetricEvent" AS ENUM ('LOGIN');

-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "amountCents" INTEGER,
ADD COLUMN     "dueDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "resetToken" TEXT,
ADD COLUMN     "resetTokenExpiresAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UsageMetric" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "userId" TEXT,
    "event" "UsageMetricEvent" NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageMetric_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageMetric_orgId_createdAt_idx" ON "UsageMetric"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "UsageMetric_orgId_event_createdAt_idx" ON "UsageMetric"("orgId", "event", "createdAt");

-- CreateIndex
CREATE INDEX "UsageMetric_userId_createdAt_idx" ON "UsageMetric"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UsageMetric" ADD CONSTRAINT "UsageMetric_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UsageMetric" ADD CONSTRAINT "UsageMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
