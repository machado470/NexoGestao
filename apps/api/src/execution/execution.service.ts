import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { AuditService } from '../audit/audit.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'
import { RequestContextService } from '../common/context/request-context.service'
import { MetricsService } from '../common/metrics/metrics.service'
import { FinanceService } from '../finance/finance.service'

function normalizeText(value?: string | null): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

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
        assignedToPersonId: true,
        status: true,
        title: true,
        description: true,
        outcomeSummary: true,
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
        executorPersonId: serviceOrder.assignedToPersonId ?? null,
        startedAt: serviceOrder.startedAt,
        endedAt: serviceOrder.finishedAt,
        notes:
          serviceOrder.outcomeSummary ??
          serviceOrder.description ??
          null,
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
        assignedToPersonId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        description: true,
        outcomeSummary: true,
        amountCents: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!so) {
      throw new NotFoundException('ServiceOrder não encontrada')
    }

    if (so.status === 'CANCELED') {
      throw new BadRequestException(
        'Não é permitido iniciar execução de O.S. cancelada',
      )
    }

    if (so.status === 'DONE') {
      return {
        id: so.id,
        orgId: so.orgId,
        serviceOrderId: so.id,
        customerId: so.customerId,
        executorPersonId:
          input.executorPersonId ?? so.assignedToPersonId ?? null,
        startedAt: so.startedAt,
        endedAt: so.finishedAt,
        notes: so.outcomeSummary ?? so.description ?? null,
        checklist: input.checklist ?? [],
        attachments: input.attachments ?? [],
        status: so.status,
        amountCents: so.amountCents ?? null,
        dueDate: so.dueDate ?? null,
        mode: 'service-order-fallback',
        createdAt: so.createdAt,
        updatedAt: so.updatedAt,
        idempotent: true,
      }
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
        assignedToPersonId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        description: true,
        outcomeSummary: true,
        amountCents: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!updated) {
      throw new NotFoundException('ServiceOrder não encontrada')
    }

    const actorPersonId =
      input.executorPersonId ?? updated.assignedToPersonId ?? null

    await this.timeline.log({
      orgId: input.orgId,
      personId: actorPersonId,
      action: 'EXECUTION_STARTED',
      description: 'Execução iniciada em modo fallback por ServiceOrder',
      metadata: {
        executionId: updated.id,
        serviceOrderId: updated.id,
        customerId: updated.customerId,
        executorPersonId: actorPersonId,
        notes: normalizeText(input.notes),
        checklist: input.checklist ?? [],
        attachments: input.attachments ?? [],
        amountCents: updated.amountCents ?? null,
        dueDate: updated.dueDate ?? null,
        actorPersonId,
        fallbackMode: true,
      },
    })

    await this.audit.log({
      orgId: input.orgId,
      action: 'EXECUTION_STARTED',
      actorPersonId,
      personId: actorPersonId,
      entityType: 'SERVICE_ORDER',
      entityId: updated.id,
      context: 'Execution started (fallback)',
      metadata: {
        serviceOrderId: updated.id,
        customerId: updated.customerId,
        notes: normalizeText(input.notes),
        checklist: input.checklist ?? [],
        attachments: input.attachments ?? [],
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
        executorPersonId: actorPersonId,
      }),
    )

    return {
      id: updated.id,
      orgId: updated.orgId,
      serviceOrderId: updated.id,
      customerId: updated.customerId,
      executorPersonId: actorPersonId,
      startedAt: updated.startedAt,
      endedAt: updated.finishedAt,
      notes: normalizeText(input.notes) ?? updated.description ?? null,
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
        assignedToPersonId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        description: true,
        outcomeSummary: true,
        amountCents: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!existing) {
      throw new NotFoundException('Execution não encontrada')
    }

    if (existing.status === 'CANCELED') {
      throw new BadRequestException(
        'Não é permitido concluir execução de O.S. cancelada',
      )
    }

    const alreadyDone = existing.status === 'DONE'
    const normalizedNotes = normalizeText(input.notes)

    if (!alreadyDone) {
      await this.prisma.serviceOrder.updateMany({
        where: { id: input.executionId, orgId: input.orgId },
        data: {
          status: 'DONE',
          startedAt: existing.startedAt ?? new Date(),
          finishedAt: new Date(),
          ...(normalizedNotes ? { outcomeSummary: normalizedNotes } : {}),
        },
      })
    }

    const updated = await this.prisma.serviceOrder.findFirst({
      where: { id: input.executionId, orgId: input.orgId },
      select: {
        id: true,
        orgId: true,
        customerId: true,
        assignedToPersonId: true,
        status: true,
        startedAt: true,
        finishedAt: true,
        description: true,
        outcomeSummary: true,
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
      const actorPersonId = updated.assignedToPersonId ?? null

      await this.timeline.log({
        orgId: input.orgId,
        personId: actorPersonId,
        action: 'EXECUTION_DONE',
        description: 'Execução concluída em modo fallback por ServiceOrder',
        metadata: {
          executionId: updated.id,
          serviceOrderId: updated.id,
          customerId: updated.customerId,
          requestId,
          notes: normalizedNotes,
          checklist: input.checklist ?? [],
          attachments: input.attachments ?? [],
          amountCents: updated.amountCents ?? null,
          dueDate: updated.dueDate ?? null,
          actorUserId: userId ?? null,
          actorPersonId,
          fallbackMode: true,
        },
      })

      await this.audit.log({
        orgId: input.orgId,
        action: AUDIT_ACTIONS.EXECUTION_COMPLETED,
        actorUserId: userId,
        actorPersonId,
        personId: actorPersonId,
        entityType: 'SERVICE_ORDER',
        entityId: updated.id,
        context: 'Execution completed (fallback)',
        metadata: {
          requestId,
          serviceOrderId: updated.id,
          customerId: updated.customerId,
          notes: normalizedNotes,
          checklist: input.checklist ?? [],
          attachments: input.attachments ?? [],
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
      executorPersonId: updated.assignedToPersonId ?? null,
      startedAt: updated.startedAt,
      endedAt: updated.finishedAt,
      notes:
        normalizedNotes ??
        updated.outcomeSummary ??
        updated.description ??
        null,
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
