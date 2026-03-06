-- Idempotency guard: one charge per service order in an org
CREATE UNIQUE INDEX IF NOT EXISTS "Charge_orgId_serviceOrderId_key"
  ON "Charge"("orgId", "serviceOrderId");

-- Idempotency guard: one payment per charge in an org
CREATE UNIQUE INDEX IF NOT EXISTS "Payment_orgId_chargeId_key"
  ON "Payment"("orgId", "chargeId");
