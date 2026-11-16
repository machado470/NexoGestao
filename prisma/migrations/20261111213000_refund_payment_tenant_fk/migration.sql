CREATE UNIQUE INDEX "Payment_id_orgId_key" ON "Payment"("id", "orgId");
ALTER TABLE "PaymentRefund" DROP CONSTRAINT "PaymentRefund_paymentId_fkey";
ALTER TABLE "PaymentRefund" ADD CONSTRAINT "PaymentRefund_paymentId_orgId_fkey"
  FOREIGN KEY ("paymentId", "orgId") REFERENCES "Payment"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;
