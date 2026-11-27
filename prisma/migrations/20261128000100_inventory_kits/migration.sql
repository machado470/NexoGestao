ALTER TABLE "InventoryProduct" DROP CONSTRAINT "InventoryProduct_family_shape_check";
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_family_shape_check" CHECK (
  ("kind" = 'VARIANT' AND "parentId" IS NOT NULL AND "parentId" <> "id")
  OR ("kind" = 'SIMPLE' AND "parentId" IS NULL)
  OR ("kind" IN ('PARENT', 'KIT') AND "parentId" IS NULL AND "onHand" = 0)
);

CREATE TABLE "InventoryKitComponent" (
  "orgId" TEXT NOT NULL,
  "kitId" TEXT NOT NULL,
  "componentId" TEXT NOT NULL CHECK ("componentId" <> "kitId"),
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  PRIMARY KEY ("orgId", "kitId", "componentId"),
  CONSTRAINT "InventoryKitComponent_kitId_orgId_fkey"
    FOREIGN KEY ("kitId", "orgId") REFERENCES "InventoryProduct"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "InventoryKitComponent_componentId_orgId_fkey"
    FOREIGN KEY ("componentId", "orgId") REFERENCES "InventoryProduct"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "InventoryKitComponent_componentId_orgId_idx" ON "InventoryKitComponent"("componentId", "orgId");

CREATE TABLE "InventoryKitWithdrawal" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "kitId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
  "reason" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "entryKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryKitWithdrawal_kitId_orgId_fkey"
    FOREIGN KEY ("kitId", "orgId") REFERENCES "InventoryProduct"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "InventoryKitWithdrawal_orgId_entryKey_key" ON "InventoryKitWithdrawal"("orgId", "entryKey");
CREATE UNIQUE INDEX "InventoryKitWithdrawal_id_orgId_key" ON "InventoryKitWithdrawal"("id", "orgId");
ALTER TABLE "StockMovement" ADD COLUMN "kitWithdrawalId" TEXT,
  ADD CONSTRAINT "StockMovement_kitWithdrawalId_orgId_fkey"
    FOREIGN KEY ("kitWithdrawalId", "orgId") REFERENCES "InventoryKitWithdrawal"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "StockMovement_kitWithdrawalId_orgId_idx" ON "StockMovement"("kitWithdrawalId", "orgId");
