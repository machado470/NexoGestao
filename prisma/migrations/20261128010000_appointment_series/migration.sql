CREATE TABLE "AppointmentSeries" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orgId" TEXT NOT NULL,
  "entryKey" TEXT NOT NULL,
  "payloadHash" TEXT NOT NULL,
  "cadence" TEXT NOT NULL CHECK ("cadence" IN ('WEEKLY', 'BIWEEKLY')),
  "timezone" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AppointmentSeries_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AppointmentSeries_orgId_entryKey_key" ON "AppointmentSeries"("orgId", "entryKey");
CREATE UNIQUE INDEX "AppointmentSeries_id_orgId_key" ON "AppointmentSeries"("id", "orgId");

ALTER TABLE "Appointment"
  ADD COLUMN "seriesId" TEXT,
  ADD COLUMN "seriesPosition" INTEGER,
  ADD CONSTRAINT "Appointment_series_shape_check" CHECK (
    ("seriesId" IS NULL AND "seriesPosition" IS NULL)
    OR ("seriesId" IS NOT NULL AND "seriesPosition" IS NOT NULL AND "seriesPosition" BETWEEN 0 AND 11)
  ),
  ADD CONSTRAINT "Appointment_seriesId_orgId_fkey" FOREIGN KEY ("seriesId", "orgId")
    REFERENCES "AppointmentSeries"("id", "orgId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Appointment_seriesId_seriesPosition_key" ON "Appointment"("seriesId", "seriesPosition");
