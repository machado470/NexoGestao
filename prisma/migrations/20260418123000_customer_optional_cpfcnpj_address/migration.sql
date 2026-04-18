-- Add optional complementary fields for customer registration flow.
ALTER TABLE "Customer"
ADD COLUMN "cpfCnpj" TEXT,
ADD COLUMN "address" TEXT;
