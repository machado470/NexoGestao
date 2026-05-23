import { Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const CHECK_ENV = 'OPERATIONAL_ACTIONS_DB_STARTUP_CHECK'

const checks = [
  {
    label: 'tabela OperationalActionExecution',
    query:
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'OperationalActionExecution' LIMIT 1",
  },
  {
    label: 'coluna logicalKey em OperationalActionExecution',
    query:
      "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OperationalActionExecution' AND column_name = 'logicalKey' LIMIT 1",
  },
  {
    label: 'valor EXECUTING no enum OperationalActionExecutionStatus',
    query: `SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'OperationalActionExecutionStatus'
        AND e.enumlabel = 'EXECUTING'
      LIMIT 1`,
  },
  {
    label: 'índice único parcial REQUESTED por (orgId, logicalKey)',
    query: `SELECT 1
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'OperationalActionExecution'
        AND indexname = 'OperationalActionExecution_unique_requested_per_key'
        AND indexdef ILIKE '%UNIQUE%'
        AND indexdef ILIKE '%"orgId"%'
        AND indexdef ILIKE '%"logicalKey"%'
        AND indexdef ILIKE '%WHERE ((status = ''REQUESTED''::"OperationalActionExecutionStatus"))%'
      LIMIT 1`,
  },
] as const

export async function runOperationalActionsStartupCheck(prisma: PrismaService, logger: Logger): Promise<void> {
  const enabled = process.env[CHECK_ENV] === '1'

  if (!enabled) {
    logger.log(`[BOOT][OperationalActions] ${CHECK_ENV}!=1, startup check desativado.`)
    return
  }

  if ((process.env.NODE_ENV ?? '').toLowerCase() === 'test') {
    logger.log('[BOOT][OperationalActions] NODE_ENV=test, startup check ignorado.')
    return
  }

  logger.log('[BOOT][OperationalActions] Startup check habilitado, validando pré-condições do banco...')

  for (const check of checks) {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(check.query)
    if (!rows.length) {
      throw new Error(`[BOOT][OperationalActions] Falha no startup check: ausente ${check.label}.`)
    }
  }

  logger.log('[BOOT][OperationalActions] Startup check OK (tabela/coluna/enum/índice presentes).')
}
