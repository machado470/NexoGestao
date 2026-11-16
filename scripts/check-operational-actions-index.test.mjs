#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

// This test changes index definitions inside a rolled-back transaction.
// Refuse every target except the exact throwaway Compose smoke database.
const url = new URL(process.env.DATABASE_URL)
assert.equal(process.env.NEXO_DISPOSABLE_COMPOSE_SMOKE, '1')
assert.equal(url.hostname, 'postgres')
assert.equal(url.pathname, '/nexo_smoke')
const paths = ['scripts/check-operational-actions-db.mjs', 'apps/api/src/bootstrap/operational-actions-startup-check.ts']
const queries = paths.map(file => {
  const query = readFileSync(file, 'utf8').match(/SELECT 1\s+FROM pg_index i[\s\S]*?LIMIT 1/)?.[0]
  assert.ok(query, `Missing index check in ${file}`)
  return query
})
assert.equal(queries[0], queries[1], 'Entrypoint and API bootstrap must use the same index check')
const prisma = new PrismaClient()
const rollback = new Error('rollback disposable index checks')
try {
  await prisma.$transaction(async tx => {
    const check = async expected => {
      for (const query of queries) assert.equal((await tx.$queryRawUnsafe(query)).length > 0, expected)
    }
    const drop = () => tx.$executeRawUnsafe('DROP INDEX IF EXISTS "OperationalActionExecution_unique_requested_per_key"')
    const create = (unique, columns, predicate) => tx.$executeRawUnsafe(`CREATE ${unique} INDEX "OperationalActionExecution_unique_requested_per_key" ON "OperationalActionExecution" (${columns}) WHERE ${predicate}`)
    await check(true)
    await drop()
    await check(false)
    await create('', '"orgId", "logicalKey"', "status = 'REQUESTED'")
    await check(false)
    await drop()
    await create('UNIQUE', '"logicalKey", "orgId"', "status = 'REQUESTED'")
    await check(false)
    await drop()
    await create('UNIQUE', '"orgId", "logicalKey"', "status = 'EXECUTING'")
    await check(false)
    await drop()
    await create('UNIQUE', '"orgId", "logicalKey"', "((status = ('REQUESTED'::\"OperationalActionExecutionStatus\")))")
    await check(true)
    throw rollback
  }, { timeout: 15000 })
} catch (error) {
  if (error !== rollback) throw error
} finally {
  await prisma.$disconnect()
}
console.log('Disposable index regression checks passed; index mutations rolled back')
