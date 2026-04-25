-- Backfill values that depend on enum values added in previous migration
UPDATE "WhatsAppTemplate"
SET "messageType" = 'MANUAL'
WHERE "messageType" IS NULL;

ALTER TABLE "WhatsAppTemplate"
  ALTER COLUMN "messageType" SET DEFAULT 'MANUAL',
  ALTER COLUMN "messageType" SET NOT NULL;
