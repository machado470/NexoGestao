-- AlterTable
ALTER TABLE "TimelineEvent" ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "chargeId" TEXT,
ADD COLUMN     "customerId" TEXT,
ADD COLUMN     "serviceOrderId" TEXT;

-- CreateIndex
CREATE INDEX "TimelineEvent_orgId_customerId_createdAt_idx" ON "TimelineEvent"("orgId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_orgId_serviceOrderId_createdAt_idx" ON "TimelineEvent"("orgId", "serviceOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_orgId_appointmentId_createdAt_idx" ON "TimelineEvent"("orgId", "appointmentId", "createdAt");

-- CreateIndex
CREATE INDEX "TimelineEvent_orgId_chargeId_createdAt_idx" ON "TimelineEvent"("orgId", "chargeId", "createdAt");

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE SET NULL ON UPDATE CASCADE;
