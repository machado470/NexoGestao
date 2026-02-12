/*
  Warnings:

  - A unique constraint covering the columns `[slug,version,orgId]` on the table `Track` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `orgId` to the `Track` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "Track_slug_version_key";

-- AlterTable
ALTER TABLE "AuditEvent" ADD COLUMN     "metadata" JSONB;

-- AlterTable
ALTER TABLE "Track" ADD COLUMN     "orgId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "AuditEvent_personId_createdAt_idx" ON "AuditEvent"("personId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_action_createdAt_idx" ON "AuditEvent"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Track_orgId_idx" ON "Track"("orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Track_slug_version_orgId_key" ON "Track"("slug", "version", "orgId");

-- AddForeignKey
ALTER TABLE "Track" ADD CONSTRAINT "Track_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
