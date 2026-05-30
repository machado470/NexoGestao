-- Add a minimal, optional planned workload capacity layer for each person.
-- Existing rows receive safe operational defaults while nullable columns preserve
-- compatibility with imports or legacy records that may intentionally omit capacity.
ALTER TABLE "Person"
  ADD COLUMN "dailyServiceOrderCapacity" INTEGER DEFAULT 5,
  ADD COLUMN "dailyAppointmentCapacity" INTEGER DEFAULT 5,
  ADD COLUMN "workloadNotes" TEXT;
