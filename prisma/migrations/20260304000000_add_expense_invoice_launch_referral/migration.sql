-- Migration: add_expense_invoice_launch_referral
-- Criada em: 2026-03-04
-- Descrição: Adiciona modelos Expense, Invoice, Launch e Referral para persistência real

-- ─── Expense ────────────────────────────────────────────────────────────────
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "orgId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "receiptUrl" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- ─── Invoice ────────────────────────────────────────────────────────────────
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "orgId" TEXT NOT NULL,
    "customerId" TEXT,
    "number" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "dueDate" TIMESTAMP(3),
    "issuedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- ─── Launch ─────────────────────────────────────────────────────────────────
CREATE TABLE "Launch" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "orgId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "account" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Launch_pkey" PRIMARY KEY ("id")
);

-- ─── Referral ───────────────────────────────────────────────────────────────
CREATE TABLE "Referral" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "orgId" TEXT NOT NULL,
    "referrerName" TEXT NOT NULL,
    "referrerEmail" TEXT NOT NULL,
    "referrerPhone" TEXT,
    "referredName" TEXT NOT NULL,
    "referredEmail" TEXT NOT NULL,
    "referredPhone" TEXT,
    "creditAmountCents" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "code" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

-- ─── Índices de performance ──────────────────────────────────────────────────
CREATE INDEX "Expense_orgId_idx" ON "Expense"("orgId");
CREATE INDEX "Expense_orgId_date_idx" ON "Expense"("orgId", "date");
CREATE INDEX "Expense_orgId_category_idx" ON "Expense"("orgId", "category");

CREATE UNIQUE INDEX "Invoice_orgId_number_key" ON "Invoice"("orgId", "number");
CREATE INDEX "Invoice_orgId_idx" ON "Invoice"("orgId");
CREATE INDEX "Invoice_orgId_status_idx" ON "Invoice"("orgId", "status");
CREATE INDEX "Invoice_customerId_idx" ON "Invoice"("customerId");

CREATE INDEX "Launch_orgId_idx" ON "Launch"("orgId");
CREATE INDEX "Launch_orgId_date_idx" ON "Launch"("orgId", "date");
CREATE INDEX "Launch_orgId_type_idx" ON "Launch"("orgId", "type");

CREATE UNIQUE INDEX "Referral_code_key" ON "Referral"("code");
CREATE INDEX "Referral_orgId_idx" ON "Referral"("orgId");
CREATE INDEX "Referral_orgId_status_idx" ON "Referral"("orgId", "status");
CREATE INDEX "Referral_referrerEmail_idx" ON "Referral"("referrerEmail");

-- ─── Foreign Keys ────────────────────────────────────────────────────────────
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Launch" ADD CONSTRAINT "Launch_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Launch" ADD CONSTRAINT "Launch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Referral" ADD CONSTRAINT "Referral_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
