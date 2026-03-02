-- CreateEnum
CREATE TYPE "OperationalStateValue" AS ENUM ('NORMAL', 'WARNING', 'RESTRICTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Person" ADD COLUMN     "operationalRiskScore" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "operationalState" "OperationalStateValue" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "operationalStateUpdatedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Person_orgId_operationalState_operationalRiskScore_operatio_idx" ON "Person"("orgId", "operationalState", "operationalRiskScore", "operationalStateUpdatedAt");
