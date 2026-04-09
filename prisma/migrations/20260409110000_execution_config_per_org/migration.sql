-- CreateEnum
CREATE TYPE "ExecutionMode" AS ENUM ('manual', 'semi_automatic', 'automatic');

-- CreateTable
CREATE TABLE "OrganizationExecutionConfig" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "mode" "ExecutionMode" NOT NULL DEFAULT 'manual',
  "policy" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OrganizationExecutionConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationExecutionConfig_orgId_key" ON "OrganizationExecutionConfig"("orgId");

-- CreateIndex
CREATE INDEX "OrganizationExecutionConfig_mode_updatedAt_idx" ON "OrganizationExecutionConfig"("mode", "updatedAt");

-- AddForeignKey
ALTER TABLE "OrganizationExecutionConfig" ADD CONSTRAINT "OrganizationExecutionConfig_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
