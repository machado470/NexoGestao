-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "currency" TEXT,
ADD COLUMN     "entryKey" TEXT;

-- CreateTable
CREATE TABLE "InventoryProduct" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "barcode" TEXT,
    "variant" TEXT,
    "minQuantity" INTEGER NOT NULL DEFAULT 0,
    "onHand" INTEGER NOT NULL DEFAULT 0,
    "costCents" INTEGER NOT NULL DEFAULT 0,
    "saleCents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serviceOrderId" TEXT,
    "direction" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "entryKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FiscalDraft" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "serviceOrderId" TEXT,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "entryKey" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FiscalDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProduct_orgId_sku_key" ON "InventoryProduct"("orgId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryProduct_id_orgId_key" ON "InventoryProduct"("id", "orgId");

-- CreateIndex
CREATE INDEX "StockMovement_orgId_createdAt_idx" ON "StockMovement"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockMovement_orgId_entryKey_key" ON "StockMovement"("orgId", "entryKey");

-- CreateIndex
CREATE INDEX "FiscalDraft_orgId_createdAt_idx" ON "FiscalDraft"("orgId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FiscalDraft_orgId_entryKey_key" ON "FiscalDraft"("orgId", "entryKey");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_id_orgId_key" ON "Customer"("id", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "ServiceOrder_id_orgId_key" ON "ServiceOrder"("id", "orgId");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_orgId_entryKey_key" ON "Expense"("orgId", "entryKey");

-- AddForeignKey
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_orgId_fkey" FOREIGN KEY ("productId", "orgId") REFERENCES "InventoryProduct"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_serviceOrderId_orgId_fkey" FOREIGN KEY ("serviceOrderId", "orgId") REFERENCES "ServiceOrder"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDraft" ADD CONSTRAINT "FiscalDraft_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDraft" ADD CONSTRAINT "FiscalDraft_customerId_orgId_fkey" FOREIGN KEY ("customerId", "orgId") REFERENCES "Customer"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FiscalDraft" ADD CONSTRAINT "FiscalDraft_serviceOrderId_orgId_fkey" FOREIGN KEY ("serviceOrderId", "orgId") REFERENCES "ServiceOrder"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Balances and money cannot bypass the HTTP validation through another writer.
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_values_check" CHECK ("onHand" >= 0 AND "minQuantity" >= 0 AND "costCents" >= 0 AND "saleCents" >= 0 AND "currency" ~ '^[A-Z]{3}$');
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_values_check" CHECK ("quantity" > 0 AND "direction" IN ('IN', 'OUT') AND length(btrim("reason")) >= 3);
ALTER TABLE "FiscalDraft" ADD CONSTRAINT "FiscalDraft_values_check" CHECK ("amountCents" > 0 AND length(btrim("description")) >= 5 AND "currency" ~ '^[A-Z]{3}$');
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_currency_check" CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$');
