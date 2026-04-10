import 'reflect-metadata'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { PrismaClient, Prisma } from '@prisma/client'
import { ExecutionRunner } from '../src/execution/execution.runner'
import { ExecutionConfigService } from '../src/execution/execution.config'
import { ExecutionGovernanceService } from '../src/execution/execution.governance'

type ScriptArgs = {
  outputPath: string
}

type ExecutionEventRow = {
  id: string
  createdAt: string
  actionId: string
  decisionId: string
  entityType: string
  entityId: string
  status: string
  reasonCode: string | null
  mode: string | null
  explanation: Record<string, unknown> | null
}

type ScenarioAssertion = {
  id: 'billing-followup-or-reminder' | 'risk-escalation' | 'operational-attention'
  ok: boolean
  required: boolean
  matchedEventId: string | null
  matchedActionId: string | null
  matchedStatus: string | null
  matchedReasonCode: string | null
  hasExplanation: boolean
  details: string
}

function parseArgs(argv: string[]): ScriptArgs {
  const defaultOutputPath = path.resolve(process.cwd(), 'artifacts/execution-v5-e2e.json')
  const outputArg = argv.find((arg) => arg.startsWith('--output='))
  if (!outputArg) return { outputPath: defaultOutputPath }

  const outputPath = outputArg.split('=')[1]?.trim()
  return { outputPath: outputPath ? path.resolve(process.cwd(), outputPath) : defaultOutputPath }
}

function getStringValue(input: unknown): string {
  return typeof input === 'string' ? input : ''
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function explainPrismaError(error: unknown): string | null {
  const dbTarget = getDatabaseTargetLabel(process.env.DATABASE_URL)
  if (error instanceof Prisma.PrismaClientInitializationError) {
    if (error.errorCode === 'P1001') {
      return `Banco indisponível (P1001). Verifique se o Postgres está ativo e acessível em ${dbTarget}.`
    }
    return `Falha de inicialização do Prisma (${error.errorCode ?? 'sem código'}): ${error.message}`
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2021') {
      return 'Schema/tabelas não encontradas (P2021). Execute migrations antes da validação.'
    }
    return `Falha Prisma (${error.code}): ${error.message}`
  }

  return null
}

function getDatabaseTargetLabel(databaseUrl: string | undefined): string {
  if (!databaseUrl) return 'DATABASE_URL não informada'

  try {
    const parsed = new URL(databaseUrl)
    return `${parsed.hostname}:${parsed.port || '5432'}`
  } catch {
    return 'DATABASE_URL inválida'
  }
}

class ScriptExecutionEventsAdapter {
  constructor(private readonly prisma: PrismaClient) {}

  async recordEvent(orgId: string, payload: Record<string, unknown>) {
    await this.prisma.timelineEvent.create({
      data: {
        orgId,
        action: 'EXECUTION_EVENT',
        description: `${getStringValue(payload.actionId)} => ${getStringValue(payload.status)}`,
        metadata: payload as Prisma.InputJsonValue,
      },
    })
  }

  async hasRecentExecution(params: { orgId: string; executionKey: string; withinMs: number }) {
    const since = new Date(Date.now() - params.withinMs)
    const row = await this.prisma.timelineEvent.findFirst({
      where: {
        orgId: params.orgId,
        action: 'EXECUTION_EVENT',
        createdAt: { gte: since },
        metadata: { path: ['executionKey'], equals: params.executionKey },
        OR: [
          { metadata: { path: ['status'], equals: 'executed' } },
          { metadata: { path: ['eventType'], equals: 'EXECUTION_ACTION_REQUESTED' } },
        ],
      },
      select: { id: true },
    })

    return Boolean(row?.id)
  }

  async countRecentFailures(params: { orgId: string; executionKey: string; withinMs: number }) {
    const since = new Date(Date.now() - params.withinMs)
    return this.prisma.timelineEvent.count({
      where: {
        orgId: params.orgId,
        action: 'EXECUTION_EVENT',
        createdAt: { gte: since },
        metadata: { path: ['executionKey'], equals: params.executionKey },
        OR: [
          { metadata: { path: ['status'], equals: 'failed' } },
          { metadata: { path: ['status'], equals: 'throttled' } },
        ],
      },
    })
  }
}

class ScriptFinanceStub {
  constructor(private readonly prisma: PrismaClient) {}

  async ensureChargeForServiceOrderDone(input: {
    orgId: string
    serviceOrderId: string
    customerId: string
    amountCents: number
    dueDate: Date | null
  }) {
    await this.prisma.charge.create({
      data: {
        orgId: input.orgId,
        serviceOrderId: input.serviceOrderId,
        customerId: input.customerId,
        amountCents: input.amountCents,
        dueDate: input.dueDate,
        status: 'PENDING',
        notes: 'generated-by-execution-v5-e2e-script',
      },
    })
  }

  async sendChargeWhatsApp(chargeId: string) {
    await this.prisma.timelineEvent.create({
      data: {
        orgId: (await this.prisma.charge.findUniqueOrThrow({ where: { id: chargeId }, select: { orgId: true } })).orgId,
        action: 'WHATSAPP_PAYMENT_LINK_SIMULATED',
        chargeId,
        description: 'Simulação de envio de link de pagamento para validação E2E.',
        metadata: { source: 'validate-execution-v5-script' },
      },
    })
  }

  async sendPaymentReminderWhatsApp(chargeId: string) {
    await this.prisma.timelineEvent.create({
      data: {
        orgId: (await this.prisma.charge.findUniqueOrThrow({ where: { id: chargeId }, select: { orgId: true } })).orgId,
        action: 'WHATSAPP_OVERDUE_REMINDER_SIMULATED',
        chargeId,
        description: 'Simulação de lembrete de cobrança vencida para validação E2E.',
        metadata: { source: 'validate-execution-v5-script' },
      },
    })
  }
}

async function loadExecutionEvents(prisma: PrismaClient, orgId: string) {
  const rows = await prisma.timelineEvent.findMany({
    where: { orgId, action: 'EXECUTION_EVENT' },
    orderBy: { createdAt: 'asc' },
  })

  return rows.map((row) => {
    const metadata = (row.metadata ?? {}) as Record<string, unknown>
    return {
      id: row.id,
      createdAt: row.createdAt.toISOString(),
      actionId: getStringValue(metadata.actionId),
      decisionId: getStringValue(metadata.decisionId),
      entityType: getStringValue(metadata.entityType),
      entityId: getStringValue(metadata.entityId),
      status: getStringValue(metadata.status),
      reasonCode: typeof metadata.reasonCode === 'string' ? metadata.reasonCode : null,
      mode: typeof metadata.mode === 'string' ? metadata.mode : null,
      explanation:
        metadata.explanation && typeof metadata.explanation === 'object'
          ? (metadata.explanation as Record<string, unknown>)
          : null,
    } satisfies ExecutionEventRow
  })
}

type ScenarioMatcherInput = {
  events: ExecutionEventRow[]
  id: ScenarioAssertion['id']
  required: boolean
  actionIds: string[]
  expectedReasonCodesWhenBlocked?: string[]
}

function assertScenarioMatcher(input: ScenarioMatcherInput): ScenarioAssertion {
  const matched = input.events
    .slice()
    .reverse()
    .find((event) => input.actionIds.includes(event.actionId))

  if (!matched) {
    return {
      id: input.id,
      required: input.required,
      ok: !input.required,
      matchedEventId: null,
      matchedActionId: null,
      matchedStatus: null,
      matchedReasonCode: null,
      hasExplanation: false,
      details: input.required
        ? `Nenhum evento encontrado para ações [${input.actionIds.join(', ')}].`
        : `Cenário opcional sem ocorrência para ações [${input.actionIds.join(', ')}].`,
    }
  }

  const hasReasonCode = Boolean(matched.reasonCode)
  const hasExplanation = Boolean(matched.explanation && Object.keys(matched.explanation).length > 0)
  const isExecuted = matched.status === 'executed'
  const isBlocked = matched.status === 'blocked' || matched.status === 'requires_confirmation'
  const blockedReasonAllowed = input.expectedReasonCodesWhenBlocked
    ? input.expectedReasonCodesWhenBlocked.includes(matched.reasonCode ?? '')
    : true

  const ok = (isExecuted || (isBlocked && blockedReasonAllowed)) && hasReasonCode && hasExplanation

  return {
    id: input.id,
    required: input.required,
    ok: input.required ? ok : true,
    matchedEventId: matched.id,
    matchedActionId: matched.actionId,
    matchedStatus: matched.status,
    matchedReasonCode: matched.reasonCode,
    hasExplanation,
    details: ok
      ? `${matched.actionId} validado com status=${matched.status} reason=${matched.reasonCode}.`
      : `${matched.actionId} inválido: status=${matched.status}, reason=${matched.reasonCode}, hasExplanation=${hasExplanation}.`,
  }
}

function assertScenario(events: ExecutionEventRow[]): ScenarioAssertion[] {
  const billingReasonCodes = [
    'executed',
    'policy_overdue_reminder_automatic_disabled',
    'policy_charge_followup_creation_disabled',
    'idempotency_recent_execution',
  ]
  const riskReasonCodes = [
    'executed',
    'policy_risk_review_escalation_disabled',
    'idempotency_recent_execution',
  ]

  return [
    assertScenarioMatcher({
      id: 'billing-followup-or-reminder',
      required: true,
      events,
      actionIds: ['action-create-charge-followup', 'action-send-overdue-charge-reminder'],
      expectedReasonCodesWhenBlocked: billingReasonCodes,
    }),
    assertScenarioMatcher({
      id: 'risk-escalation',
      required: true,
      events,
      actionIds: ['action-escalate-risk-review'],
      expectedReasonCodesWhenBlocked: riskReasonCodes,
    }),
    assertScenarioMatcher({
      id: 'operational-attention',
      required: false,
      events,
      actionIds: ['action-mark-operational-attention'],
      expectedReasonCodesWhenBlocked: ['idempotency_recent_execution', 'policy_operational_attention_disabled'],
    }),
  ]
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL não definido. Configure o banco Postgres e execute novamente. Exemplo: DATABASE_URL=postgresql://postgres:postgres@localhost:5433/nexogestao?schema=public',
    )
  }

  const prisma = new PrismaClient()
  try {
    await prisma.$connect()
    await prisma.$queryRaw`SELECT 1`

    const unique = `e2e-v5-${Date.now()}`
    const startedAt = new Date().toISOString()

    const executionConfig = new ExecutionConfigService(prisma as never)
    const governance = new ExecutionGovernanceService()
    const eventsAdapter = new ScriptExecutionEventsAdapter(prisma)
    const financeStub = new ScriptFinanceStub(prisma)
    const metricsStub = { increment: () => undefined } as any

    const runner = new ExecutionRunner(
      prisma as never,
      financeStub as never,
      executionConfig,
      governance,
      eventsAdapter as never,
      metricsStub,
    )

    const org = await prisma.organization.create({
      data: {
        name: `Execution E2E ${unique}`,
        slug: unique,
        executionConfig: {
          create: {
            mode: 'automatic',
            policy: {
              allowAutomaticCharge: false,
              allowWhatsAppAuto: false,
              allowOverdueReminderAuto: true,
              allowFinanceTeamNotifications: true,
              allowGovernanceFollowup: true,
              allowChargeFollowupCreation: true,
              allowRiskReviewEscalation: true,
              maxRetries: 3,
              throttleWindowMs: 30 * 60 * 1000,
            },
          },
        },
      },
      select: { id: true, slug: true },
    })

    const customer = await prisma.customer.create({
      data: {
        orgId: org.id,
        name: 'Cliente E2E Execution v5',
        phone: `+5511999${String(Date.now()).slice(-6)}`,
        email: `${unique}@example.com`,
      },
      select: { id: true },
    })

    await prisma.charge.createMany({
      data: Array.from({ length: 8 }).map((_, idx) => ({
        orgId: org.id,
        customerId: customer.id,
        amountCents: 10000 + idx * 1000,
        status: 'OVERDUE',
        dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * (9 + idx)),
        notes: `execution-v5-overdue-${idx}`,
      })),
    })

    await prisma.serviceOrder.createMany({
      data: Array.from({ length: 12 }).map((_, idx) => ({
        orgId: org.id,
        customerId: customer.id,
        title: `OS travada ${idx + 1}`,
        status: idx % 2 === 0 ? 'OPEN' : 'IN_PROGRESS',
        amountCents: 20000,
      })),
    })

    const firstRun = await runner.runOnce()
    const secondRun = await runner.runOnce()

    await executionConfig.recordConfigHistory({
      orgId: org.id,
      actorUserId: 'script-user',
      actorEmail: 'script-user@nexo.test',
      source: 'validate-execution-v5-script',
      context: 'e2e-real-validation',
      before: { mode: 'automatic' },
      after: { mode: 'semi_automatic' },
    })

    const allEvents = await loadExecutionEvents(prisma, org.id)
    const scenarioAssertions = assertScenario(allEvents)

    const idempotencyBlockedCount = allEvents.filter((event) => event.reasonCode === 'idempotency_recent_execution').length
    const configHistoryCount = await prisma.timelineEvent.count({
      where: { orgId: org.id, action: 'EXECUTION_CONFIG_CHANGED' },
    })

    const timelineActionCounts = await prisma.timelineEvent.groupBy({
      by: ['action'],
      where: { orgId: org.id },
      _count: { action: true },
    })

    const result = {
      startedAt,
      finishedAt: new Date().toISOString(),
      orgId: org.id,
      orgSlug: org.slug,
      runSummary: {
        firstRun,
        secondRun,
      },
      events: {
        total: allEvents.length,
        executed: allEvents.filter((event) => event.status === 'executed').length,
        blocked: allEvents.filter((event) => event.status === 'blocked' || event.status === 'requires_confirmation').length,
        failed: allEvents.filter((event) => event.status === 'failed').length,
        throttled: allEvents.filter((event) => event.status === 'throttled').length,
        idempotencyBlockedCount,
      },
      scenarioAssertions,
      scenarioSummary: {
        requiredTotal: scenarioAssertions.filter((scenario) => scenario.required).length,
        requiredPassing: scenarioAssertions.filter((scenario) => scenario.required && scenario.ok).length,
        optionalTotal: scenarioAssertions.filter((scenario) => !scenario.required).length,
        optionalObserved: scenarioAssertions.filter((scenario) => !scenario.required && scenario.matchedEventId).length,
      },
      policyEvidence: {
        whatsappAutoDisabledBlocked: allEvents.some(
          (event) => event.actionId === 'action-send-whatsapp-payment-link'
            && event.reasonCode === 'policy_whatsapp_automatic_disabled',
        ),
        automaticChargeDisabledBlocked: allEvents.some(
          (event) => event.actionId === 'action-generate-charge'
            && event.reasonCode === 'policy_automatic_charge_disabled',
        ),
      },
      timelineActionCounts: timelineActionCounts.map((item) => ({ action: item.action, count: item._count.action })),
      configHistoryCount,
      sampleEvents: allEvents.slice(-20),
    }

    console.log(JSON.stringify(result, null, 2))

    await fs.mkdir(path.dirname(args.outputPath), { recursive: true })
    await fs.writeFile(args.outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8')
    console.log(`validate-execution-v5: relatório salvo em ${args.outputPath}`)

    const failingScenario = scenarioAssertions.find((scenario) => scenario.required && !scenario.ok)
    if (failingScenario) {
      throw new Error(`Cenário obrigatório inválido: ${failingScenario.id} - ${failingScenario.details}`)
    }

    if (idempotencyBlockedCount === 0) {
      throw new Error('Validação de idempotência falhou: nenhum bloqueio por idempotency_recent_execution foi registrado.')
    }

    if (configHistoryCount === 0) {
      throw new Error('Validação de histórico de config falhou: nenhum evento EXECUTION_CONFIG_CHANGED encontrado.')
    }
  } catch (error) {
    const explainedError = explainPrismaError(error)
    if (explainedError) {
      throw new Error(
        `${explainedError}\nChecklist rápido:\n- Confirme DATABASE_URL.\n- Rode migrations: pnpm --filter ./apps/api prisma migrate deploy.\n- Se necessário, confira status: pnpm --filter ./apps/api prisma migrate status.`,
      )
    }
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(async (error) => {
  console.error('[validate-execution-v5] falha:', getErrorMessage(error))
  process.exit(1)
})
