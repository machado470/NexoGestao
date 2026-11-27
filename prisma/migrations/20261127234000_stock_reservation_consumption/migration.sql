ALTER TABLE "StockReservation"
  ADD COLUMN "consumedAt" TIMESTAMP(3),
  ADD CONSTRAINT "StockReservation_resolution_check"
    CHECK ("releasedAt" IS NULL OR "consumedAt" IS NULL);

ALTER TABLE "StockMovement"
  ADD COLUMN "reservationId" TEXT,
  ADD CONSTRAINT "StockMovement_reservationId_fkey"
    FOREIGN KEY ("reservationId") REFERENCES "StockReservation"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE UNIQUE INDEX "StockMovement_reservationId_key" ON "StockMovement"("reservationId");
