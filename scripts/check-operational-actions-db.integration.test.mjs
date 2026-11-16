import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

// Run against a migrated PostgreSQL database with DATABASE_URL set.
// Only temporary tables and indexes are created; application data is untouched.
test('Operational Actions index validation uses index metadata', {
  skip: !process.env.DATABASE_URL,
}, async () => {
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient()
  const sources = [
    'scripts/check-operational-actions-db.mjs',
    'apps/api/src/bootstrap/operational-actions-startup-check.ts',
  ]
  const cases = [
    { name: 'valid REQUESTED index', unique: true, keys: '"orgId", "logicalKey"', status: 'REQUESTED', expected: true },
    { name: 'nonunique index', unique: false, keys: '"orgId", "logicalKey"', status: 'REQUESTED', expected: false },
    { name: 'reversed keys', unique: true, keys: '"logicalKey", "orgId"', status: 'REQUESTED', expected: false },
    { name: 'no predicate', unique: true, keys: '"orgId", "logicalKey"', status: null, expected: false },
    { name: 'wrong status', unique: true, keys: '"orgId", "logicalKey"', status: 'EXECUTING', expected: false },
  ]

  try {
    for (const source of sources) {
      const text = await readFile(new URL(`../${source}`, import.meta.url), 'utf8')
      const label = text.indexOf("'índice único parcial REQUESTED")
      const start = text.indexOf('`SELECT 1', label)
      const end = text.indexOf('`', start + 1)
      assert.ok(label >= 0 && start >= 0 && end > start, `index query in ${source}`)
      const query = text.slice(start + 1, end)
        .replace("ns.nspname = 'public'", 'ns.oid = pg_my_temp_schema()')
      assert.ok(query.includes('ns.oid = pg_my_temp_schema()'))

      for (const scenario of cases) {
        await prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`CREATE TEMP TABLE "OperationalActionExecution" (
            "orgId" text, "logicalKey" text,
            status public."OperationalActionExecutionStatus"
          ) ON COMMIT DROP`)
          const predicate = scenario.status
            ? ` WHERE status = '${scenario.status}'::public."OperationalActionExecutionStatus"`
            : ''
          await tx.$executeRawUnsafe(`CREATE ${scenario.unique ? 'UNIQUE ' : ''}INDEX
            "OperationalActionExecution_unique_requested_per_key"
            ON pg_temp."OperationalActionExecution" (${scenario.keys})${predicate}`)
          const rows = await tx.$queryRawUnsafe(query)
          assert.equal(rows.length > 0, scenario.expected, `${source}: ${scenario.name}`)
        })
      }
    }
  } finally {
    await prisma.$disconnect()
  }
})
