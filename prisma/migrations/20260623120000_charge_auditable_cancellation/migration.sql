ALTER TABLE "Charge"
  ADD COLUMN "canceledAt" TIMESTAMP(3),
  ADD COLUMN "cancellationReason" TEXT,
  ADD COLUMN "canceledByUserId" TEXT;
