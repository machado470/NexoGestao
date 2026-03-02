-- Baseline: WhatsApp sending claim/lock (já aplicado manualmente em 2026-02-26)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'WhatsAppMessageStatus' AND e.enumlabel = 'SENDING'
  ) THEN
    ALTER TYPE "WhatsAppMessageStatus" ADD VALUE 'SENDING';
  END IF;
END $$;

ALTER TABLE "WhatsAppMessage"
  ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);

ALTER TABLE "WhatsAppMessage"
  ADD COLUMN IF NOT EXISTS "lockedBy" TEXT;
