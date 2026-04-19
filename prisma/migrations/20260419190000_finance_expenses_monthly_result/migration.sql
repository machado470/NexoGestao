-- Expense domain hardening for monthly financial result
DO $$ BEGIN
  CREATE TYPE "ExpenseType" AS ENUM ('FIXED', 'VARIABLE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseRecurrence" AS ENUM ('NONE', 'MONTHLY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "ExpenseCategory" AS ENUM (
    'HOUSING',
    'ELECTRICITY',
    'WATER',
    'INTERNET',
    'PAYROLL',
    'MARKET',
    'TRANSPORT',
    'LEISURE',
    'OPERATIONS',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Expense"
  ADD COLUMN IF NOT EXISTS "title" TEXT,
  ADD COLUMN IF NOT EXISTS "type" "ExpenseType" DEFAULT 'VARIABLE',
  ADD COLUMN IF NOT EXISTS "recurrence" "ExpenseRecurrence" DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "dueDay" INTEGER,
  ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

UPDATE "Expense"
SET "title" = COALESCE(NULLIF(trim("description"), ''), 'Despesa sem título')
WHERE "title" IS NULL;

UPDATE "Expense"
SET "occurredAt" = COALESCE("date", "createdAt")
WHERE "occurredAt" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Expense' AND column_name = 'category' AND udt_name <> 'ExpenseCategory'
  ) THEN
    ALTER TABLE "Expense" ADD COLUMN IF NOT EXISTS "category_new" "ExpenseCategory";

    UPDATE "Expense"
    SET "category_new" = CASE UPPER(COALESCE("category"::text, ''))
      WHEN 'OPERATIONAL' THEN 'OPERATIONS'::"ExpenseCategory"
      WHEN 'MARKETING' THEN 'OPERATIONS'::"ExpenseCategory"
      WHEN 'INFRASTRUCTURE' THEN 'OPERATIONS'::"ExpenseCategory"
      WHEN 'PAYROLL' THEN 'PAYROLL'::"ExpenseCategory"
      WHEN 'TAXES' THEN 'OPERATIONS'::"ExpenseCategory"
      WHEN 'SUPPLIES' THEN 'MARKET'::"ExpenseCategory"
      WHEN 'TRAVEL' THEN 'TRANSPORT'::"ExpenseCategory"
      WHEN 'HOUSING' THEN 'HOUSING'::"ExpenseCategory"
      WHEN 'ELECTRICITY' THEN 'ELECTRICITY'::"ExpenseCategory"
      WHEN 'WATER' THEN 'WATER'::"ExpenseCategory"
      WHEN 'INTERNET' THEN 'INTERNET'::"ExpenseCategory"
      WHEN 'MARKET' THEN 'MARKET'::"ExpenseCategory"
      WHEN 'TRANSPORT' THEN 'TRANSPORT'::"ExpenseCategory"
      WHEN 'LEISURE' THEN 'LEISURE'::"ExpenseCategory"
      WHEN 'OPERATIONS' THEN 'OPERATIONS'::"ExpenseCategory"
      ELSE 'OTHER'::"ExpenseCategory"
    END;

    ALTER TABLE "Expense" DROP COLUMN "category";
    ALTER TABLE "Expense" RENAME COLUMN "category_new" TO "category";
  END IF;
END $$;

ALTER TABLE "Expense"
  ALTER COLUMN "title" SET NOT NULL,
  ALTER COLUMN "occurredAt" SET NOT NULL,
  ALTER COLUMN "category" TYPE "ExpenseCategory" USING "category"::"ExpenseCategory",
  ALTER COLUMN "category" SET NOT NULL,
  ALTER COLUMN "type" SET NOT NULL,
  ALTER COLUMN "recurrence" SET NOT NULL;

ALTER TABLE "Expense"
  ALTER COLUMN "description" DROP NOT NULL;

ALTER TABLE "Expense"
  DROP COLUMN IF EXISTS "date";

CREATE INDEX IF NOT EXISTS "Expense_orgId_occurredAt_idx" ON "Expense"("orgId", "occurredAt");
CREATE INDEX IF NOT EXISTS "Expense_orgId_recurrence_isActive_idx" ON "Expense"("orgId", "recurrence", "isActive");
CREATE INDEX IF NOT EXISTS "Expense_orgId_category_occurredAt_idx" ON "Expense"("orgId", "category", "occurredAt");
