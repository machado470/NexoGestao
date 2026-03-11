import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { AuditService } from '../audit/audit.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'
import { RequestContextService } from '../common/context/request-context.service'
import { MetricsService } from '../common/metrics/metrics.service'
import { FinanceService } from '../finance/finance.service'

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly audit: AuditService,
    private readonly requestContext: RequestContextService,
    private readonly metrics: MetricsService,
    private readonly finance: FinanceService,
  ) {}

  async listByServiceOrder(orgId: string, serviceOrderId: string) {
    const serviceOrder = await this.prisma.serviceOrder.findFirst({
      where: { id: serviceOrderId, orgId },
      select: {
        id: true,
        orgId: true,
        customerId: true,
        status: true,
        title: true,
        description: true,
        scheduledFor: true,
        startedAt: true,
        finishedAt: true,
        amountCents: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!serviceOrder) {
      throw new NotFoundException('ServiceOrder não encontrada')
    }

    return [
      {
        id: serviceOrder.id,
        orgId: serviceOrder.orgId,
        serviceOrderId: serviceOrder.id,
        customerId: serviceOrder.customerId,
        executorPersonId: null,
        startedAt: serviceOrder.startedAt,
        endedAt: serviceOrder.finishedAt,
        notes: serviceOrder.description ?? null,
        checklist: [],
        attachments: [],
        status: serviceOrder.status,
        amountCents: serviceOrder.amountCents ?? null,
        dueDate: serviceOrder.dueDate ?? null,
        mode: 'service-order-fallback',
        createdAt: serviceOrder.createdAt,
        updatedAt: serviceOrder.updatedAt,
      },
    ]
  }

  async start(input: {
    orgId: string
    serviceOrderId: string
    executorPersonId?: string | null
    notes?: string
    checklist?: any
    attachments?: any
  }) {
    const so = await this.prisma.serviceOrder.findFirst({
      where: { id: input.serviceOrderId, orgId: input.orgId },
      select: {
        id: true,
        orgId: true,
        customerId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        amountCents: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!so) {
      throw new NotFoundException('ServiceOrder não encontrada')
    }

    await this.prisma.serviceOrder.updateMany({
      where: { id: input.serviceOrderId, orgId: input.orgId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: so.startedAt ?? new Date(),
      },
    })

    const updated = await this.prisma.serviceOrder.findFirst({
      where: { id: input.serviceOrderId, orgId: input.orgId },
      select: {
        id: true,
        orgId: true,
        customerId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        description: true,
        amountCents: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!updated) {
      throw new NotFoundException('ServiceOrder não encontrada')
    }

    await this.timeline.log({
      orgId: input.orgId,
      personId: input.executorPersonId ?? null,
      action: 'EXECUTION_STARTED',
      description: 'Execução iniciada em modo fallback por ServiceOrder',
      metadata: {
        executionId: updated.id,
        serviceOrderId: updated.id,
        customerId: updated.customerId,
        executorPersonId: input.executorPersonId ?? null,
        notes: input.notes ?? null,
        checklist: input.checklist ?? [],
        attachments: input.attachments ?? [],
        amountCents: updated.amountCents ?? null,
        dueDate: updated.dueDate ?? null,
        fallbackMode: true,
      },
    })

    await this.audit.log({
      orgId: input.orgId,
      action: 'EXECUTION_STARTED',
      actorPersonId: input.executorPersonId ?? null,
      personId: input.executorPersonId ?? null,
      entityType: 'SERVICE_ORDER',
      entityId: updated.id,
      context: 'Execution started (fallback)',
      metadata: {
        serviceOrderId: updated.id,
        customerId: updated.customerId,
        notes: input.notes ?? null,
        amountCents: updated.amountCents ?? null,
        dueDate: updated.dueDate ?? null,
        fallbackMode: true,
      },
    })

    this.logger.warn(
      JSON.stringify({
        event: 'execution_start_fallback',
        orgId: input.orgId,
        serviceOrderId: updated.id,
        customerId: updated.customerId,
      }),
    )

    return {
      id: updated.id,
      orgId: updated.orgId,
      serviceOrderId: updated.id,
      customerId: updated.customerId,
      executorPersonId: input.executorPersonId ?? null,
      startedAt: updated.startedAt,
      endedAt: updated.finishedAt,
      notes: input.notes ?? updated.description ?? null,
      checklist: input.checklist ?? [],
      attachments: input.attachments ?? [],
      status: updated.status,
      amountCents: updated.amountCents ?? null,
      dueDate: updated.dueDate ?? null,
      mode: 'service-order-fallback',
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }
  }

  async complete(input: {
    orgId: string
    executionId: string
    notes?: string
    checklist?: any
    attachments?: any
  }) {
    const existing = await this.prisma.serviceOrder.findFirst({
      where: { id: input.executionId, orgId: input.orgId },
      select: {
        id: true,
        orgId: true,
        customerId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        description: true,
        amountCents: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!existing) {
      throw new NotFoundException('Execution não encontrada')
    }

    const alreadyDone = existing.status === 'DONE'

    if (!alreadyDone) {
      await this.prisma.serviceOrder.updateMany({
        where: { id: input.executionId, orgId: input.orgId },
        data: {
          status: 'DONE',
          finishedAt: new Date(),
          ...(typeof input.notes === 'string' && input.notes.trim()
            ? { description: input.notes.trim() }
            : {}),
        },
      })
    }

    const updated = await this.prisma.serviceOrder.findFirst({
      where: { id: input.executionId, orgId: input.orgId },
      select: {
        id: true,
        orgId: true,
        customerId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        description: true,
        amountCents: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!updated) {
      throw new NotFoundException('Execution não encontrada')
    }

    if (!alreadyDone) {
      const requestId = this.requestContext.requestId
      const userId = this.requestContext.userId

      await this.timeline.log({
        orgId: input.orgId,
        action: 'EXECUTION_DONE',
        description: 'Execução concluída em modo fallback por ServiceOrder',
        metadata: {
          executionId: updated.id,
          serviceOrderId: updated.id,
          customerId: updated.customerId,
          requestId,
          notes: input.notes ?? null,
          checklist: input.checklist ?? [],
          attachments: input.attachments ?? [],
          amountCents: updated.amountCents ?? null,
          dueDate: updated.dueDate ?? null,
          fallbackMode: true,
        },
      })

      await this.audit.log({
        orgId: input.orgId,
        action: AUDIT_ACTIONS.EXECUTION_COMPLETED,
        actorUserId: userId,
        entityType: 'SERVICE_ORDER',
        entityId: updated.id,
        context: 'Execution completed (fallback)',
        metadata: {
          requestId,
          serviceOrderId: updated.id,
          customerId: updated.customerId,
          amountCents: updated.amountCents ?? null,
          dueDate: updated.dueDate ?? null,
          fallbackMode: true,
        },
      })

      try {
        await this.finance.ensureChargeForServiceOrderDone({
          orgId: input.orgId,
          serviceOrderId: updated.id,
          customerId: updated.customerId,
          actorUserId: userId ?? null,
          actorPersonId: null,
          amountCents: updated.amountCents ?? undefined,
          dueDate: updated.dueDate ?? null,
        })
      } catch (err) {
        this.logger.warn(
          JSON.stringify({
            event: 'execution_charge_creation_failed',
            requestId,
            userId,
            orgId: input.orgId,
            serviceOrderId: updated.id,
            error: err instanceof Error ? err.message : String(err),
          }),
        )
      }

      this.metrics.increment('executionsCompleted')

      this.logger.warn(
        JSON.stringify({
          event: 'execution_completion_fallback',
          requestId,
          userId,
          orgId: input.orgId,
          executionId: updated.id,
          serviceOrderId: updated.id,
        }),
      )
    }

    return {
      id: updated.id,
      orgId: updated.orgId,
      serviceOrderId: updated.id,
      customerId: updated.customerId,
      executorPersonId: null,
      startedAt: updated.startedAt,
      endedAt: updated.finishedAt,
      notes: input.notes ?? updated.description ?? null,
      checklist: input.checklist ?? [],
      attachments: input.attachments ?? [],
      status: updated.status,
      amountCents: updated.amountCents ?? null,
      dueDate: updated.dueDate ?? null,
      mode: 'service-order-fallback',
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      ...(alreadyDone ? { idempotent: true } : {}),
    }
  }
}
