BEGIN;
-- CreateTable
CREATE TABLE "ServiceQuoteOrder" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "quoteVersion" INTEGER NOT NULL,
    "approvalId" TEXT NOT NULL,
    "serviceOrderId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdByName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceQuoteOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuoteOrder_quoteId_key" ON "ServiceQuoteOrder"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuoteOrder_approvalId_key" ON "ServiceQuoteOrder"("approvalId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuoteOrder_serviceOrderId_key" ON "ServiceQuoteOrder"("serviceOrderId");

-- CreateIndex
CREATE INDEX "ServiceQuoteOrder_orgId_serviceOrderId_idx" ON "ServiceQuoteOrder"("orgId", "serviceOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuoteOrder_quoteId_orgId_key" ON "ServiceQuoteOrder"("quoteId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuoteOrder_serviceOrderId_orgId_key" ON "ServiceQuoteOrder"("serviceOrderId", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuoteOrder_approvalId_orgId_quoteId_quoteVersion_key" ON "ServiceQuoteOrder"("approvalId", "orgId", "quoteId", "quoteVersion");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceQuoteApproval_id_orgId_quoteId_quoteVersion_key" ON "ServiceQuoteApproval"("id", "orgId", "quoteId", "quoteVersion");

-- AddForeignKey
ALTER TABLE "ServiceQuoteOrder" ADD CONSTRAINT "ServiceQuoteOrder_quoteId_orgId_fkey" FOREIGN KEY ("quoteId", "orgId") REFERENCES "ServiceQuote"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuoteOrder" ADD CONSTRAINT "ServiceQuoteOrder_approvalId_orgId_quoteId_quoteVersion_fkey" FOREIGN KEY ("approvalId", "orgId", "quoteId", "quoteVersion") REFERENCES "ServiceQuoteApproval"("id", "orgId", "quoteId", "quoteVersion") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServiceQuoteOrder" ADD CONSTRAINT "ServiceQuoteOrder_serviceOrderId_orgId_fkey" FOREIGN KEY ("serviceOrderId", "orgId") REFERENCES "ServiceOrder"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ServiceOrder" DROP CONSTRAINT "ServiceOrder_billingTreatment";
ALTER TABLE "ServiceOrder" ADD CONSTRAINT "ServiceOrder_billingTreatment" CHECK ("billingTreatment" IN ('STANDARD','RETURN_PENDING','RETURN_COVERED','RETURN_BILLABLE','QUOTE_NO_CHARGE'));
ALTER TABLE "ServiceQuoteOrder" ADD CONSTRAINT "ServiceQuoteOrder_values" CHECK ("amountCents" >= 0 AND "currency" ~ '^[A-Z]{3}$' AND "quoteVersion" >= 0);
CREATE FUNCTION nexo_validate_quote_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE q RECORD; s RECORD;
BEGIN
 IF TG_OP = 'UPDATE' THEN RAISE EXCEPTION 'NEXO_QUOTE_TERMS_LOCKED' USING ERRCODE='23514'; END IF;
 SELECT quote.status, quote."customerId", quote.version, approval.decision, revision.snapshot INTO q
 FROM "ServiceQuote" quote JOIN "ServiceQuoteApproval" approval ON approval.id=NEW."approvalId" AND approval."quoteId"=quote.id AND approval."orgId"=quote."orgId"
 JOIN "ServiceQuoteRevision" revision ON revision."quoteId"=quote.id AND revision.version=NEW."quoteVersion" AND revision."orgId"=quote."orgId"
 WHERE quote.id=NEW."quoteId" AND quote."orgId"=NEW."orgId";
 SELECT * INTO s FROM "ServiceOrder" WHERE id=NEW."serviceOrderId" AND "orgId"=NEW."orgId" FOR UPDATE;
 IF q.status IS DISTINCT FROM 'ACCEPTED' OR q.decision IS DISTINCT FROM 'ACCEPTED' OR q.version IS DISTINCT FROM NEW."quoteVersion"
 OR (q.snapshot->>'totalCents')::integer IS DISTINCT FROM NEW."amountCents" OR q.snapshot->>'currency' IS DISTINCT FROM NEW.currency
 OR s."customerId" IS DISTINCT FROM q."customerId" OR s."amountCents" IS DISTINCT FROM NEW."amountCents"
 OR s."billingTreatment" IS DISTINCT FROM (CASE WHEN NEW."amountCents"=0 THEN 'QUOTE_NO_CHARGE' ELSE 'STANDARD' END)
 OR EXISTS (SELECT 1 FROM "Charge" WHERE "serviceOrderId"=NEW."serviceOrderId")
 THEN RAISE EXCEPTION 'NEXO_QUOTE_TERMS_LOCKED' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER nexo_quote_order_valid BEFORE INSERT OR UPDATE ON "ServiceQuoteOrder" FOR EACH ROW EXECUTE FUNCTION nexo_validate_quote_order();
CREATE FUNCTION nexo_preserve_quote_order() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE terms RECORD;
BEGIN
 SELECT conversion.*,quote."customerId" INTO terms FROM "ServiceQuoteOrder" conversion JOIN "ServiceQuote" quote ON quote.id=conversion."quoteId" WHERE conversion."serviceOrderId"=OLD.id;
 IF FOUND AND (NEW."orgId" IS DISTINCT FROM terms."orgId" OR NEW."customerId" IS DISTINCT FROM terms."customerId" OR NEW."amountCents" IS DISTINCT FROM terms."amountCents" OR NEW."billingTreatment" IS DISTINCT FROM (CASE WHEN terms."amountCents"=0 THEN 'QUOTE_NO_CHARGE' ELSE 'STANDARD' END))
 THEN RAISE EXCEPTION 'NEXO_QUOTE_TERMS_LOCKED' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER nexo_quote_order_preserve BEFORE UPDATE OF "orgId","customerId","amountCents","billingTreatment" ON "ServiceOrder" FOR EACH ROW EXECUTE FUNCTION nexo_preserve_quote_order();
CREATE FUNCTION nexo_preserve_quote_charge() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE terms RECORD;
BEGIN
 IF NEW."serviceOrderId" IS NOT NULL THEN
  PERFORM id FROM "ServiceOrder" WHERE id=NEW."serviceOrderId" AND "orgId"=NEW."orgId" FOR UPDATE;
  SELECT conversion.*,quote."customerId" INTO terms FROM "ServiceQuoteOrder" conversion JOIN "ServiceQuote" quote ON quote.id=conversion."quoteId" WHERE conversion."serviceOrderId"=NEW."serviceOrderId";
  IF FOUND AND (terms."amountCents"=0 OR NEW."orgId" IS DISTINCT FROM terms."orgId" OR NEW."customerId" IS DISTINCT FROM terms."customerId" OR NEW."amountCents" IS DISTINCT FROM terms."amountCents" OR NEW.currency IS DISTINCT FROM terms.currency)
  THEN RAISE EXCEPTION 'NEXO_QUOTE_TERMS_LOCKED' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER nexo_quote_charge_preserve BEFORE INSERT OR UPDATE OF "orgId","customerId","serviceOrderId","amountCents",currency ON "Charge" FOR EACH ROW EXECUTE FUNCTION nexo_preserve_quote_charge();

COMMIT;
