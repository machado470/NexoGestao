import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../src/app.module'
import { ExecutionRunner } from '../src/execution/execution.runner'
import { PrismaService } from '../src/prisma/prisma.service'

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false })
  const prisma = app.get(PrismaService)
  const runner = app.get(ExecutionRunner)

  const unique = `e2e-${Date.now()}`
  const org = await prisma.organization.create({
    data: {
      name: `Execution E2E ${unique}`,
      slug: unique,
      executionConfig: {
        create: {
          mode: 'automatic',
          policy: {
            allowAutomaticCharge: true,
            allowWhatsAppAuto: false,
            allowOverdueReminderAuto: true,
            allowFinanceTeamNotifications: true,
            allowGovernanceFollowup: true,
            allowChargeFollowupCreation: true,
            allowRiskReviewEscalation: true,
            maxRetries: 3,
            throttleWindowMs: 10000,
          },
        },
      },
    },
    select: { id: true, slug: true },
  })

  const customer = await prisma.customer.create({
    data: {
      orgId: org.id,
      name: 'Cliente E2E Execution',
      phone: `+5511999${String(Date.now()).slice(-6)}`,
      email: `${unique}@example.com`,
    },
    select: { id: true },
  })

  const serviceOrder = await prisma.serviceOrder.create({
    data: {
      orgId: org.id,
      customerId: customer.id,
      title: 'OS concluída para gerar cobrança automática',
      status: 'DONE',
      amountCents: 35900,
      dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12),
    },
    select: { id: true },
  })

  await prisma.charge.createMany({
    data: Array.from({ length: 8 }).map((_, idx) => ({
      orgId: org.id,
      customerId: customer.id,
      serviceOrderId: idx === 0 ? serviceOrder.id : null,
      amountCents: 10000 + idx * 1000,
      status: 'OVERDUE',
      dueDate: new Date(Date.now() - 1000 * 60 * 60 * 24 * (9 + idx)),
      notes: `overdue-${idx}`,
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

  const runResult = await runner.runOnce()

  const events = await prisma.timelineEvent.findMany({
    where: {
      orgId: org.id,
      action: 'EXECUTION_EVENT',
      metadata: {
        path: ['status'],
        equals: 'executed',
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 40,
  })

  const executedActions = Array.from(
    new Set(events.map((event) => String((event.metadata as any)?.actionId ?? 'unknown'))),
  )

  const governanceUpdate = await prisma.timelineEvent.create({
    data: {
      orgId: org.id,
      action: 'EXECUTION_CONFIG_CHANGED',
      description: 'Registro simulado de alteração para inspeção de histórico',
      metadata: {
        orgId: org.id,
        actorUserId: 'seed-user',
        actorEmail: 'seed-user@nexo.test',
        source: 'validate-execution-v5-script',
        context: 'script-validation',
        changedAt: new Date().toISOString(),
        before: { mode: 'automatic' },
        after: { mode: 'semi_automatic' },
      },
    },
    select: { id: true },
  })

  const historyCount = await prisma.timelineEvent.count({
    where: { orgId: org.id, action: 'EXECUTION_CONFIG_CHANGED' },
  })

  console.log(JSON.stringify({
    orgId: org.id,
    orgSlug: org.slug,
    runResult,
    executedActions,
    executedEventCount: events.length,
    configHistoryCount: historyCount,
    configHistorySampleId: governanceUpdate.id,
  }, null, 2))

  await app.close()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
