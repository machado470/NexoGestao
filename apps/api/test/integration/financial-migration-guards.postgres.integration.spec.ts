import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PrismaClient } from '@prisma/client'
import { describeRealIntegration } from './infra-guards'

// Temp tables shadow the production names only inside a rolled-back test transaction.
describeRealIntegration('Financial migration legacy-data guards', () => {
  const db = new PrismaClient()
  const migration = readFileSync(resolve(__dirname, '../../../../prisma/migrations/20261109170000_enforce_invoice_and_payment_integrity/migration.sql'), 'utf8')
  const guard = migration.match(/DO \$\$[\s\S]*?END \$\$;/)![0]
  afterAll(async () => { await db.$disconnect() })
  it.each([
    ['tenant', 'Invoice customer tenant mismatch'],
    ['invoice', 'Duplicate invoice numbers'],
    ['payment', 'Duplicate external payment references'],
  ])('refuses inconsistent legacy %s records without rewriting data', async (kind, message) => {
    await expect(db.$transaction(async tx => {
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "Customer" (id TEXT, "orgId" TEXT) ON COMMIT DROP')
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "Invoice" ("orgId" TEXT, "customerId" TEXT, number TEXT) ON COMMIT DROP')
      await tx.$executeRawUnsafe('CREATE TEMP TABLE "Payment" ("orgId" TEXT, "externalRef" TEXT) ON COMMIT DROP')
      if (kind === 'tenant') {
        await tx.$executeRawUnsafe(`INSERT INTO "Customer" VALUES ('customer-b','b')`)
        await tx.$executeRawUnsafe(`INSERT INTO "Invoice" VALUES ('a','customer-b','1')`)
      } else if (kind === 'invoice') {
        await tx.$executeRawUnsafe(`INSERT INTO "Invoice" VALUES ('a',NULL,'1'),('a',NULL,'1')`)
      } else {
        await tx.$executeRawUnsafe(`INSERT INTO "Payment" VALUES ('a','ref'),('a','ref')`)
      }
      await tx.$executeRawUnsafe(guard)
    })).rejects.toThrow(message)
    // The public application tables remain intact after the guard aborts the transaction.
    await expect(db.invoice.count()).resolves.toBeGreaterThanOrEqual(0)
  })
})
