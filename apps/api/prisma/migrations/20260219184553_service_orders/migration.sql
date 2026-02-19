-- CreateEnum
CREATE TYPE "ServiceOrderStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'DONE', 'CANCELED');

-- CreateTable
CREATE TABLE "ServiceOrder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "appointmentId" TEXT,
    "assignedToPersonId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "ServiceOrderStatus" NOT NULL DEFAULT 'OPEN',
    "priority" INTEGER NOT NULL DEFAULT 2,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ServiceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_appointmentId_key" ON "ServiceOrder"("appointmentId");

-- CreateIndex
CREATE INDEX "ServiceOrder_orgId_createdAt_idx" ON "ServiceOrder"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_orgId_status_createdAt_idx" ON "ServiceOrder"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_orgId_customerId_createdAt_idx" ON "ServiceOrder"("orgId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_orgId_scheduledFor_idx" ON "ServiceOrder"("orgId", "scheduledFor");

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_assignedToPersonId_fkey" FOREIGN KEY ("assignedToPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
