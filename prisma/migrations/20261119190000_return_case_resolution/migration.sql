-- AlterTable
ALTER TABLE "ServiceOrderReturn" ADD COLUMN     "caseReason" TEXT,
ADD COLUMN     "caseReviewedAt" TIMESTAMP(3),
ADD COLUMN     "caseReviewedByName" TEXT,
ADD COLUMN     "caseReviewedByUserId" TEXT,
ADD COLUMN     "caseState" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "caseVersion" INTEGER NOT NULL DEFAULT 0;

-- Existing cases remain active: execution status alone does not imply a reviewed outcome.
ALTER TABLE "ServiceOrderReturn" ADD CONSTRAINT "ServiceOrderReturn_case_state" CHECK ("caseState" IN ('ACTIVE', 'CLOSED'));
ALTER TABLE "ServiceOrderReturn" ADD CONSTRAINT "ServiceOrderReturn_case_review" CHECK (
 ("caseVersion" = 0 AND "caseState" = 'ACTIVE' AND "caseReason" IS NULL AND "caseReviewedAt" IS NULL AND "caseReviewedByName" IS NULL AND "caseReviewedByUserId" IS NULL)
 OR ("caseVersion" > 0 AND "caseReason" IS NOT NULL AND length(trim("caseReason")) BETWEEN 10 AND 1000 AND "caseReviewedAt" IS NOT NULL AND "caseReviewedByName" IS NOT NULL AND "caseReviewedByUserId" IS NOT NULL)
);
