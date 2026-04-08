-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "ServiceOrder" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Charge" ADD COLUMN "idempotencyKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Customer_orgId_phone_key" ON "Customer"("orgId", "phone");
CREATE UNIQUE INDEX "Customer_orgId_email_key" ON "Customer"("orgId", "email");
CREATE UNIQUE INDEX "Appointment_idempotencyKey_key" ON "Appointment"("idempotencyKey");
CREATE UNIQUE INDEX "ServiceOrder_idempotencyKey_key" ON "ServiceOrder"("idempotencyKey");
CREATE UNIQUE INDEX "Charge_idempotencyKey_key" ON "Charge"("idempotencyKey");
