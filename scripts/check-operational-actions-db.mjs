#!/usr/bin/env node
import process from 'node:process'
import { PrismaClient } from '@prisma/client'

const requireStrict = process.env.REQUIRE_DATABASE_SMOKE === '1'
const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  const msg = '[db-smoke] DATABASE_URL ausente. Smoke de banco pulado.'
  if (requireStrict) {
    console.error(`${msg} Defina DATABASE_URL ou desative REQUIRE_DATABASE_SMOKE=1.`)
    process.exit(1)
  }
  console.warn(`${msg} Para tornar obrigatório, rode com REQUIRE_DATABASE_SMOKE=1.`)
  process.exit(0)
}

const prisma = new PrismaClient()

async function assertExists(description, sql) {
  const rows = await prisma.$queryRawUnsafe(sql)
  const exists = Array.isArray(rows) && rows.length > 0
  if (!exists) {
    throw new Error(`[db-smoke] Falha: ${description} não encontrado(a).`)
  }
  console.log(`[db-smoke] OK: ${description}.`)
}

async function main() {
  await assertExists(
    'tabela OperationalActionExecution',
    `SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'OperationalActionExecution' LIMIT 1`,
  )

  await assertExists(
    'coluna logicalKey em OperationalActionExecution',
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OperationalActionExecution' AND column_name = 'logicalKey' LIMIT 1`,
  )

  await assertExists(
    "valor EXECUTING no enum OperationalActionExecutionStatus",
    `SELECT 1
     FROM pg_type t
     JOIN pg_enum e ON t.oid = e.enumtypid
     WHERE t.typname = 'OperationalActionExecutionStatus'
       AND e.enumlabel = 'EXECUTING'
     LIMIT 1`,
  )

  await assertExists(
    'índice único parcial REQUESTED por (orgId, logicalKey)',
    `SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'OperationalActionExecution'
        AND indexname = 'OperationalActionExecution_unique_requested_per_key'
        AND indexdef ILIKE '%UNIQUE%'
        AND indexdef ILIKE '%"orgId"%'
        AND indexdef ILIKE '%"logicalKey"%'
        AND indexdef ILIKE '%WHERE ((status = ''REQUESTED''::"OperationalActionExecutionStatus"))%'
      LIMIT 1`,
  )
}

main()
  .then(async () => {
    console.log('[db-smoke] Smoke check de Operational Actions concluído com sucesso.')
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error?.message ?? error)
    await prisma.$disconnect()
    process.exit(1)
  })
