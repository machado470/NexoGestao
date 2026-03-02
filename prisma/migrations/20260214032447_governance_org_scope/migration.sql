/*
  Warnings:

  - You are about to drop the `Event` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_personId_fkey";

-- DropTable
DROP TABLE "Event";

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "personId" TEXT,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceRun" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "evaluated" INTEGER NOT NULL DEFAULT 0,
    "warnings" INTEGER NOT NULL DEFAULT 0,
    "correctives" INTEGER NOT NULL DEFAULT 0,
    "institutionalRiskScore" INTEGER NOT NULL DEFAULT 0,
    "restrictedCount" INTEGER NOT NULL DEFAULT 0,
    "suspendedCount" INTEGER NOT NULL DEFAULT 0,
    "openCorrectivesCount" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GovernanceRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimelineEvent_personId_createdAt_idx" ON "TimelineEvent"("personId", "createdAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_action_createdAt_idx" ON "TimelineEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "GovernanceRun_orgId_createdAt_idx" ON "GovernanceRun"("orgId", "createdAt");

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceRun" ADD CONSTRAINT "GovernanceRun_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
