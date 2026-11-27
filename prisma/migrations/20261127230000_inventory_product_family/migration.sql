CREATE TYPE "InventoryProductKind" AS ENUM ('SIMPLE', 'PARENT', 'VARIANT');

ALTER TABLE "InventoryProduct"
  ADD COLUMN "kind" "InventoryProductKind" NOT NULL DEFAULT 'SIMPLE',
  ADD COLUMN "parentId" TEXT,
  ADD CONSTRAINT "InventoryProduct_parentId_orgId_fkey"
    FOREIGN KEY ("parentId", "orgId") REFERENCES "InventoryProduct"("id", "orgId")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "InventoryProduct_family_shape_check" CHECK (
    ("kind" = 'VARIANT' AND "parentId" IS NOT NULL AND "parentId" <> "id")
    OR ("kind" = 'SIMPLE' AND "parentId" IS NULL)
    OR ("kind" = 'PARENT' AND "parentId" IS NULL AND "onHand" = 0)
  );

CREATE INDEX "InventoryProduct_orgId_parentId_idx" ON "InventoryProduct"("orgId", "parentId");
