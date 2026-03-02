-- Hardening: Appointment.endsAt must be NOT NULL
-- Backfill included for safety in older environments.

UPDATE "Appointment"
SET "endsAt" = "startsAt" + interval '30 minutes'
WHERE "endsAt" IS NULL;

ALTER TABLE "Appointment"
ALTER COLUMN "endsAt" SET NOT NULL;
