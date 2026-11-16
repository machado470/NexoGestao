import { Logger } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

const CHECK_ENV = 'OPERATIONAL_ACTIONS_DB_STARTUP_CHECK'

const checks = [
  {
    key: 'table',
    label: 'tabela OperationalActionExecution',
    query:
      "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'OperationalActionExecution' LIMIT 1",
  },
  {
    key: 'column',
    label: 'coluna logicalKey em OperationalActionExecution',
    query:
      "SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'OperationalActionExecution' AND column_name = 'logicalKey' LIMIT 1",
  },
  {
    key: 'enum',
    label: 'valor EXECUTING no enum OperationalActionExecutionStatus',
    query: `SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'OperationalActionExecutionStatus'
        AND e.enumlabel = 'EXECUTING'
      LIMIT 1`,
  },
  {
    key: 'index',
    label: 'índice único parcial REQUESTED por (orgId, logicalKey)',
    query: `SELECT 1
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
  },
] as const

function isEnabledByEnvironment(): boolean {
  const explicit = process.env[CHECK_ENV]
  if (explicit === '1') return true
  if (explicit === '0') return false

  return (process.env.NODE_ENV ?? '').toLowerCase() === 'production'
}

export async function runOperationalActionsStartupCheck(prisma: PrismaService, logger: Logger): Promise<void> {
  if ((process.env.NODE_ENV ?? '').toLowerCase() === 'test') {
    logger.log('[BOOT][OperationalActions] NODE_ENV=test, startup check ignorado.')
    return
  }

  const enabled = isEnabledByEnvironment()
  if (!enabled) {
    logger.log(`[BOOT][OperationalActions] Startup check desativado (${CHECK_ENV}!=1 e NODE_ENV!=production).`)
    return
  }

  const mode = process.env[CHECK_ENV] === '1' ? 'env explícita' : 'default seguro (NODE_ENV=production)'
  logger.log(`[BOOT][OperationalActions] Startup check habilitado (${mode}), validando pré-condições do banco...`)

  const failures: string[] = []
  for (const check of checks) {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(check.query)
    if (!rows.length) failures.push(`${check.key}: ausente ${check.label}`)
  }

  if (failures.length) {
    const details = failures.map((f) => `- ${f}`).join('\n')
    throw new Error(
      `[BOOT][OperationalActions] Falha no startup check de estrutura crítica.\n${details}\n` +
        'Provável causa: migration de OperationalActionExecution não aplicada no banco alvo. ' +
        'Aplique migrations e rode o smoke de banco antes do deploy.',
    )
  }

  logger.log('[BOOT][OperationalActions] Startup check OK (tabela/coluna/enum/índice presentes).')
}
