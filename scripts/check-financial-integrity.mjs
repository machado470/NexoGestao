#!/usr/bin/env node
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()
try {
  const [result] = await db.$queryRaw`
    SELECT
      (SELECT COUNT(*) FROM "Invoice" i JOIN "Customer" c ON c.id = i."customerId" WHERE i."orgId" <> c."orgId") AS "invoiceTenantMismatches",
      (SELECT COUNT(*) FROM (SELECT 1 FROM "Invoice" GROUP BY "orgId", "number" HAVING COUNT(*) > 1) duplicates) AS "duplicateInvoiceNumbers",
      (SELECT COUNT(*) FROM (SELECT 1 FROM "Payment" WHERE "externalRef" IS NOT NULL GROUP BY "orgId", "externalRef" HAVING COUNT(*) > 1) duplicates) AS "duplicatePaymentReferences"
  `
  const counts = Object.fromEntries(Object.entries(result).map(([key, value]) => [key, String(value)]))
  console.log(JSON.stringify(counts))
  if (Object.values(result).some(value => BigInt(value) > 0n)) process.exitCode = 1
} catch (error) {
  console.error('Financial integrity check failed:', error?.code ?? 'CHECK_FAILED')
  process.exitCode = 1
} finally {
  await db.$disconnect()
}
