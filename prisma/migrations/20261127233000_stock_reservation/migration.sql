ALTER TABLE "InventoryProduct"
  ADD COLUMN "reservedQuantity" INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT "InventoryProduct_reservedQuantity_check"
    CHECK ("reservedQuantity" >= 0 AND "reservedQuantity" <= "onHand");

CREATE TABLE "StockReservation" (
  "id" TEXT NOT NULL,
  "orgId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "serviceOrderId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  "entryKey" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  "releasedByUserId" TEXT,
  CONSTRAINT "StockReservation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StockReservation_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "StockReservation_productId_orgId_fkey" FOREIGN KEY ("productId", "orgId") REFERENCES "InventoryProduct"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "StockReservation_serviceOrderId_orgId_fkey" FOREIGN KEY ("serviceOrderId", "orgId") REFERENCES "ServiceOrder"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "StockReservation_orgId_entryKey_key" ON "StockReservation"("orgId", "entryKey");
CREATE INDEX "StockReservation_orgId_serviceOrderId_releasedAt_idx" ON "StockReservation"("orgId", "serviceOrderId", "releasedAt");
