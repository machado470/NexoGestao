-- Prevent overlapping appointments per org (hard rule at DB level)
-- Requires endsAt NOT NULL (already hardened).
-- Ignore canceled appointments.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Optional: drop the old GiST index (the constraint will create its own GiST index)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'Appointment'
      AND indexname = 'Appointment_orgId_time_range_gist_idx'
  ) THEN
    EXECUTE 'DROP INDEX "Appointment_orgId_time_range_gist_idx"';
  END IF;
END $$;

-- Add EXCLUDE constraint (no overlaps within the same org)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Appointment_no_overlap_per_org'
  ) THEN
    EXECUTE '
      ALTER TABLE "Appointment"
      ADD CONSTRAINT "Appointment_no_overlap_per_org"
      EXCLUDE USING gist (
        "orgId" WITH =,
        tsrange("startsAt", "endsAt", ''[)'') WITH &&
      )
      WHERE (status <> ''CANCELED'');
    ';
  END IF;
END $$;
