-- CreateEnum
CREATE TYPE "ChargeStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CASH', 'CARD', 'TRANSFER', 'OTHER');

-- CreateTable
CREATE TABLE "Charge" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceOrderId" TEXT,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" "ChargeStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Charge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "chargeId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "externalRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Charge_orgId_createdAt_idx" ON "Charge"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Charge_orgId_status_dueDate_idx" ON "Charge"("orgId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "Charge_customerId_createdAt_idx" ON "Charge"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Charge_serviceOrderId_createdAt_idx" ON "Charge"("serviceOrderId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_orgId_createdAt_idx" ON "Payment"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_chargeId_createdAt_idx" ON "Payment"("chargeId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_orgId_paidAt_idx" ON "Payment"("orgId", "paidAt");

-- CreateIndex
CREATE INDEX "Assessment_personId_createdAt_idx" ON "Assessment"("personId", "createdAt");

-- CreateIndex
CREATE INDEX "Assessment_trackId_createdAt_idx" ON "Assessment"("trackId", "createdAt");

-- CreateIndex
CREATE INDEX "Assessment_assignmentId_createdAt_idx" ON "Assessment"("assignmentId", "createdAt");

-- CreateIndex
CREATE INDEX "Assignment_personId_createdAt_idx" ON "Assignment"("personId", "createdAt");

-- CreateIndex
CREATE INDEX "Assignment_trackId_createdAt_idx" ON "Assignment"("trackId", "createdAt");

-- CreateIndex
CREATE INDEX "CorrectiveAction_personId_status_createdAt_idx" ON "CorrectiveAction"("personId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "CorrectiveAction_status_createdAt_idx" ON "CorrectiveAction"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_orgId_email_idx" ON "Customer"("orgId", "email");

-- CreateIndex
CREATE INDEX "Person_orgId_createdAt_idx" ON "Person"("orgId", "createdAt");

-- CreateIndex
CREATE INDEX "Person_orgId_active_createdAt_idx" ON "Person"("orgId", "active", "createdAt");

-- CreateIndex
CREATE INDEX "RiskSnapshot_personId_createdAt_idx" ON "RiskSnapshot"("personId", "createdAt");

-- CreateIndex
CREATE INDEX "ServiceOrder_assignedToPersonId_createdAt_idx" ON "ServiceOrder"("assignedToPersonId", "createdAt");

-- CreateIndex
CREATE INDEX "Track_orgId_status_createdAt_idx" ON "Track"("orgId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "TrackItem_trackId_order_idx" ON "TrackItem"("trackId", "order");

-- CreateIndex
CREATE INDEX "TrackItemCompletion_personId_completedAt_idx" ON "TrackItemCompletion"("personId", "completedAt");

-- CreateIndex
CREATE INDEX "TrackItemCompletion_assignmentId_completedAt_idx" ON "TrackItemCompletion"("assignmentId", "completedAt");

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Charge" ADD CONSTRAINT "Charge_serviceOrderId_fkey" FOREIGN KEY ("serviceOrderId") REFERENCES "ServiceOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_chargeId_fkey" FOREIGN KEY ("chargeId") REFERENCES "Charge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
