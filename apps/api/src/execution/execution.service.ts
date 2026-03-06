import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { FinanceService } from '../finance/finance.service'
import { AuditService } from '../audit/audit.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'
import { RequestContextService } from '../common/context/request-context.service'
import { MetricsService } from '../common/metrics/metrics.service'

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly finance: FinanceService,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
    private readonly metrics: MetricsService,
  ) {}

  async listByServiceOrder(orgId: string, serviceOrderId: string) {
    return this.prisma.$queryRawUnsafe(
      `SELECT * FROM "Execution" WHERE "orgId"=$1 AND "serviceOrderId"=$2 ORDER BY "createdAt" DESC`,
      orgId,
      serviceOrderId,
    )
  }

  async start(input: { orgId: string; serviceOrderId: string; executorPersonId?: string | null; notes?: string; checklist?: any; attachments?: any }) {
    const so = await this.prisma.serviceOrder.findFirst({ where: { id: input.serviceOrderId, orgId: input.orgId }, select: { id: true, customerId: true } })
    if (!so) throw new NotFoundException('ServiceOrder não encontrada')
    const rows = (await this.prisma.$queryRawUnsafe(`INSERT INTO "Execution" ("id","orgId","serviceOrderId","customerId","executorPersonId","startedAt","notes","checklist","attachments","createdAt","updatedAt") VALUES (gen_random_uuid(),$1,$2,$3,$4,NOW(),$5,$6::jsonb,$7::jsonb,NOW(),NOW()) RETURNING *`, input.orgId, input.serviceOrderId, so.customerId, input.executorPersonId ?? null, input.notes ?? null, JSON.stringify(input.checklist ?? []), JSON.stringify(input.attachments ?? []))) as any[]
    const created = rows[0]
    await this.timeline.log({ orgId: input.orgId, personId: input.executorPersonId ?? null, action: 'EXECUTION_STARTED', metadata: { executionId: created.id, serviceOrderId: input.serviceOrderId, customerId: so.customerId } })
    await this.prisma.serviceOrder.updateMany({ where: { id: input.serviceOrderId, orgId: input.orgId }, data: { status: 'IN_PROGRESS', executionStartedAt: new Date() } })
    return created
  }

  async complete(input: { orgId: string; executionId: string; notes?: string; checklist?: any; attachments?: any }) {
    return this.prisma.$transaction(async (tx) => {
      const transition = await tx.execution.updateMany({
        where: { id: input.executionId, orgId: input.orgId, endedAt: null },
        data: {
          endedAt: new Date(),
          notes: input.notes ?? undefined,
          checklist: input.checklist ?? undefined,
          attachments: input.attachments ?? undefined,
        },
      })

      const updated = await tx.execution.findFirst({
        where: { id: input.executionId, orgId: input.orgId },
      })

      if (!updated) throw new NotFoundException('Execution não encontrada')

      if (transition.count === 0) {
        return { ...updated, idempotent: true }
      }

      await tx.serviceOrder.updateMany({
        where: { id: updated.serviceOrderId, orgId: input.orgId },
        data: { status: 'DONE', executionEndedAt: new Date() },
      })

      const serviceOrder = await tx.serviceOrder.findFirst({
        where: { id: updated.serviceOrderId, orgId: input.orgId },
        select: { amountCents: true, dueDate: true },
      })

      if (serviceOrder && serviceOrder.amountCents > 0) {
        await this.finance.ensureChargeForServiceOrderDone({
          orgId: input.orgId,
          serviceOrderId: updated.serviceOrderId,
          customerId: updated.customerId,
          amountCents: serviceOrder.amountCents,
          dueDate: serviceOrder.dueDate,
          tx,
        })
      }

      const requestId = this.requestContext.requestId
      const userId = this.requestContext.userId

      await tx.timelineEvent.create({
        data: {
          orgId: input.orgId,
          action: 'EXECUTION_DONE',
          metadata: {
            executionId: updated.id,
            serviceOrderId: updated.serviceOrderId,
            customerId: updated.customerId,
            requestId,
          },
        },
      })

      await this.audit.log({
        orgId: input.orgId,
        action: AUDIT_ACTIONS.EXECUTION_COMPLETED,
        actorUserId: userId,
        entityType: 'EXECUTION',
        entityId: updated.id,
        context: 'Execution completed',
        metadata: {
          requestId,
          serviceOrderId: updated.serviceOrderId,
          customerId: updated.customerId,
        },
      })

      this.metrics.increment('executionsCompleted')
      this.logger.log(
        JSON.stringify({
          event: 'execution_completion',
          requestId,
          userId,
          orgId: input.orgId,
          executionId: updated.id,
          serviceOrderId: updated.serviceOrderId,
          chargeTriggered: Boolean(serviceOrder && serviceOrder.amountCents > 0),
        }),
      )

      return updated
    })
  }
}
