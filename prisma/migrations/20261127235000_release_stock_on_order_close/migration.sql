CREATE FUNCTION "release_stock_on_order_close"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  item record;
BEGIN
  -- Reserve and consume lock the order before touching its inventory.
  -- Release outstanding reservations first and lock products in stable order.
  FOR item IN
    WITH released AS (
      UPDATE "StockReservation"
      SET "releasedAt" = CURRENT_TIMESTAMP
      WHERE "orgId" = NEW."orgId" AND "serviceOrderId" = NEW.id
        AND "releasedAt" IS NULL AND "consumedAt" IS NULL
      RETURNING "productId", quantity
    )
    SELECT "productId", SUM(quantity)::integer AS quantity
    FROM released
    GROUP BY "productId"
    ORDER BY "productId"
  LOOP
    UPDATE "InventoryProduct"
    SET "reservedQuantity" = "reservedQuantity" - item.quantity
    WHERE "orgId" = NEW."orgId" AND id = item."productId";
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "ServiceOrder_release_stock_on_close"
AFTER UPDATE OF status ON "ServiceOrder"
FOR EACH ROW WHEN (
  OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('DONE', 'CANCELED')
)
EXECUTE FUNCTION "release_stock_on_order_close"();
