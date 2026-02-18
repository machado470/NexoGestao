-- appointment overlap performance (GiST range index)
-- We index the SAME expression used by the overlap query:
-- tsrange(startsAt, COALESCE(endsAt, startsAt + interval '30 minutes'), '[)')

-- 1) Needed to allow GiST with equality on orgId in the same index strategy (optional but good)
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- 2) Expression index to accelerate: tsrange(...) && tsrange(...)
-- Note: this is a GiST index; it will be used by your $queryRaw overlap query.
CREATE INDEX IF NOT EXISTS "Appointment_orgId_time_range_gist_idx"
ON "Appointment"
USING GIST (
  "orgId",
  tsrange(
    "startsAt",
    COALESCE("endsAt", "startsAt" + interval '30 minutes'),
    '[)'
  )
);

-- 3) Optional: if you want HARD guarantee (no double booking), use exclusion constraint.
-- Uncomment to enforce at DB level (strongly recommended in production).
-- ALTER TABLE "Appointment"
-- ADD CONSTRAINT "Appointment_no_overlap_per_org"
-- EXCLUDE USING GIST (
--   "orgId" WITH =,
--   tsrange(
--     "startsAt",
--     COALESCE("endsAt", "startsAt" + interval '30 minutes'),
--     '[)'
--   ) WITH &&
-- )
-- WHERE (status <> 'CANCELED');
