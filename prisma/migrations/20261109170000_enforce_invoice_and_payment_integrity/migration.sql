BEGIN;
LOCK TABLE "Invoice", "Customer", "Payment" IN SHARE ROW EXCLUSIVE MODE;
-- Preserve existing records: refuse inconsistent data rather than silently rewriting financial history.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "Invoice" i JOIN "Customer" c ON c.id = i."customerId" WHERE i."orgId" <> c."orgId") THEN
    RAISE EXCEPTION 'Invoice customer tenant mismatch: reconcile affected invoices before applying this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM "Invoice" GROUP BY "orgId", "number" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate invoice numbers: reconcile duplicates before applying this migration';
  END IF;
  IF EXISTS (SELECT 1 FROM "Payment" WHERE "externalRef" IS NOT NULL GROUP BY "orgId", "externalRef" HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Duplicate external payment references: reconcile before applying this migration';
  END IF;
END $$;
CREATE UNIQUE INDEX "Customer_orgId_id_key" ON "Customer"("orgId", "id");
CREATE UNIQUE INDEX "Invoice_orgId_number_key" ON "Invoice"("orgId", "number");
CREATE UNIQUE INDEX "Payment_orgId_externalRef_key" ON "Payment"("orgId", "externalRef");
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_customerId_fkey";
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orgId_customerId_fkey"
  FOREIGN KEY ("orgId", "customerId") REFERENCES "Customer"("orgId", "id") ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT;
