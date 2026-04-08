ALTER TABLE "User"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailVerifyTokenHash" TEXT,
  ADD COLUMN "emailVerifyTokenExpiresAt" TIMESTAMP(3);

CREATE INDEX "User_emailVerifyTokenHash_idx" ON "User"("emailVerifyTokenHash");
