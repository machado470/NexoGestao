-- AlterTable
ALTER TABLE "ServiceOrder" ADD COLUMN     "billingTreatment" TEXT NOT NULL DEFAULT 'STANDARD';

-- AlterTable
ALTER TABLE "ServiceOrderReturn" ADD COLUMN     "coverageReason" TEXT,
ADD COLUMN     "coverageReviewedAt" TIMESTAMP(3),
ADD COLUMN     "coverageReviewedByName" TEXT,
ADD COLUMN     "coverageReviewedByUserId" TEXT,
ADD COLUMN     "coverageVersion" INTEGER NOT NULL DEFAULT 0;

-- Preserve existing commercial obligations; unbilled historical returns await review.
UPDATE "ServiceOrder" s SET "billingTreatment" = CASE WHEN EXISTS (SELECT 1 FROM "Charge" c WHERE c."orgId" = s."orgId" AND c."serviceOrderId" = s.id) THEN 'RETURN_BILLABLE' ELSE 'RETURN_PENDING' END WHERE EXISTS (SELECT 1 FROM "ServiceOrderReturn" r WHERE r."childOrderId" = s.id AND r."orgId" = s."orgId");
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_billingTreatment" CHECK ("billingTreatment" IN ('STANDARD','RETURN_PENDING','RETURN_COVERED','RETURN_BILLABLE'));
ALTER TABLE "ServiceOrderReturn" ADD CONSTRAINT "ServiceOrderReturn_coverage" CHECK (("coverageVersion" = 0 AND "coverageReason" IS NULL AND "coverageReviewedByUserId" IS NULL AND "coverageReviewedByName" IS NULL AND "coverageReviewedAt" IS NULL) OR ("coverageVersion" > 0 AND "coverageReason" IS NOT NULL AND length(trim("coverageReason")) BETWEEN 10 AND 1000 AND "coverageReviewedByUserId" IS NOT NULL AND "coverageReviewedByName" IS NOT NULL AND "coverageReviewedAt" IS NOT NULL));
CREATE FUNCTION nexo_guard_return_charge() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE treatment TEXT;
BEGIN
 IF NEW."serviceOrderId" IS NOT NULL THEN
  SELECT "billingTreatment" INTO treatment FROM "ServiceOrder" WHERE id = NEW."serviceOrderId" AND "orgId" = NEW."orgId" FOR UPDATE;
  IF treatment IN ('RETURN_PENDING','RETURN_COVERED') THEN RAISE EXCEPTION 'NEXO_RETURN_BILLING_BLOCKED' USING ERRCODE = '23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER nexo_return_charge_guard BEFORE INSERT OR UPDATE OF "serviceOrderId", "orgId" ON "Charge" FOR EACH ROW EXECUTE FUNCTION nexo_guard_return_charge();
CREATE FUNCTION nexo_guard_return_treatment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW."billingTreatment" IN ('RETURN_PENDING','RETURN_COVERED') AND EXISTS (SELECT 1 FROM "Charge" WHERE "orgId" = NEW."orgId" AND "serviceOrderId" = NEW.id) THEN RAISE EXCEPTION 'NEXO_RETURN_BILLING_BLOCKED' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER nexo_return_treatment_guard BEFORE UPDATE OF "billingTreatment" ON "ServiceOrder" FOR EACH ROW EXECUTE FUNCTION nexo_guard_return_treatment();
