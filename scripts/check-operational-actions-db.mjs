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
    `SELECT 1
      FROM pg_index i
      JOIN pg_class t ON t.oid = i.indrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_class idx ON idx.oid = i.indexrelid
      WHERE n.nspname = 'public'
        AND t.relname = 'OperationalActionExecution'
        AND idx.relname = 'OperationalActionExecution_unique_requested_per_key'
        AND i.indisunique AND i.indisvalid AND i.indisready
        AND i.indnkeyatts = 2
        AND (SELECT array_agg(a.attname::text ORDER BY k.ordinality)
             FROM unnest(i.indkey) WITH ORDINALITY AS k(attnum, ordinality)
             JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
             WHERE k.ordinality <= i.indnkeyatts) = ARRAY['orgId', 'logicalKey']
        AND regexp_replace(pg_get_expr(i.indpred, i.indrelid), '[()[:space:]]', '', 'g')
            = 'status=''REQUESTED''::"OperationalActionExecutionStatus"'
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
