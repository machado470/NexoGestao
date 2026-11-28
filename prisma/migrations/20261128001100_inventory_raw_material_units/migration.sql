CREATE TYPE "RawMaterialUnit" AS ENUM ('KG', 'L', 'M');
ALTER TABLE "InventoryProduct" ADD COLUMN "rawMaterialUnit" "RawMaterialUnit";
ALTER TABLE "InventoryProduct" DROP CONSTRAINT "InventoryProduct_family_shape_check";
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_family_shape_check" CHECK (
  ("kind" = 'VARIANT' AND "parentId" IS NOT NULL AND "parentId" <> "id")
  OR ("kind" IN ('SIMPLE', 'RAW_MATERIAL') AND "parentId" IS NULL)
  OR ("kind" IN ('PARENT', 'KIT') AND "parentId" IS NULL AND "onHand" = 0)
);
ALTER TABLE "InventoryProduct" ADD CONSTRAINT "InventoryProduct_material_unit_check" CHECK (
  ("kind" = 'RAW_MATERIAL') = ("rawMaterialUnit" IS NOT NULL)
);
