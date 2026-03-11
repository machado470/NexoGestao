import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { AuditService } from '../audit/audit.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'
import { ServiceOrderStatus } from '@prisma/client'
import { OperationalStateService } from '../people/operational-state.service'
import { FinanceService } from '../finance/finance.service'
import { AutomationService } from '../automation/automation.service'
import { NotificationsService } from '../notifications/notifications.service'
import { OnboardingService } from '../onboarding/onboarding.service'

function normalizeText(v?: string): string | null {
  const s = (v ?? '').trim()
  return s ? s : null
}

function isStatus(v: any): v is ServiceOrderStatus {
  return (
    v === 'OPEN' ||
    v === 'ASSIGNED' ||
    v === 'IN_PROGRESS' ||
    v === 'DONE' ||
    v === 'CANCELED'
  )
}

function statusToAction(status: ServiceOrderStatus): string {
  switch (status) {
    case 'ASSIGNED':
      return 'SERVICE_ORDER_ASSIGNED'
    case 'IN_PROGRESS':
      return 'SERVICE_ORDER_STARTED'
    case 'DONE':
      return 'SERVICE_ORDER_DONE'
    case 'CANCELED':
      return 'SERVICE_ORDER_CANCELED'
    case 'OPEN':
    default:
      return 'SERVICE_ORDER_UPDATED'
  }
}

@Injectable()
export class ServiceOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly audit: AuditService,
    private readonly operationalState: OperationalStateService,
    private readonly finance: FinanceService,
    private readonly automation: AutomationService,
    private readonly notificationsService: NotificationsService,
    private readonly onboardingService: OnboardingService,
  ) {}

  private canTransition(from: ServiceOrderStatus, to: ServiceOrderStatus): boolean {
    const allowed: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
      OPEN: ['ASSIGNED', 'IN_PROGRESS', 'CANCELED'],
      ASSIGNED: ['IN_PROGRESS', 'CANCELED'],
      IN_PROGRESS: ['DONE', 'CANCELED'],
      DONE: [],
      CANCELED: [],
    }
    return from === to || allowed[from].includes(to)
  }

  private async syncOperationalForPeople(
    orgId: string,
    personIds: Array<string | null | undefined>,
  ) {
    const unique = Array.from(
      new Set(
        personIds.filter(
          (x): x is string => typeof x === 'string' && x.trim().length > 0,
        ),
      ),
    )

    if (unique.length === 0) return

    for (const pid of unique) {
      try {
        await this.operationalState.syncAndLogStateChange(orgId, pid)
      } catch (err) {
        console.warn(
          '[ServiceOrders] Falha ao sync operacional. orgId=%s personId=%s err=%s',
          orgId,
          pid,
          err instanceof Error ? err.message : String(err),
        )
      }
    }
  }

  async list(
    orgId: string,
    filters: {
      status?: ServiceOrderStatus
      customerId?: string
      assignedToPersonId?: string
      page?: number
      limit?: number
    },
  ) {
    if (!orgId) throw new BadRequestException('orgId é obrigatório')

    const page = filters.page ?? 1
    const limit = Math.min(filters.limit ?? 20, 100)
    const skip = (page - 1) * limit

    const where: any = { orgId }

    if (filters.customerId) where.customerId = filters.customerId
    if (filters.assignedToPersonId) {
      where.assignedToPersonId = filters.assignedToPersonId
    }

    if (filters.status != null) {
      if (!isStatus(filters.status)) {
        throw new BadRequestException('status inválido')
      }
      where.status = filters.status
    }

    const [data, total] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          assignedTo: { select: { id: true, name: true } },
          appointment: {
            select: { id: true, startsAt: true, endsAt: true, status: true },
          },
        },
      }),
      this.prisma.serviceOrder.count({ where }),
    ])

    return {
      data,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    }
  }

  async get(orgId: string, id: string) {
    if (!orgId) throw new BadRequestException('orgId é obrigatório')
    if (!id) throw new BadRequestException('id é obrigatório')

    const os = await this.prisma.serviceOrder.findFirst({
      where: { id, orgId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
        appointment: {
          select: { id: true, startsAt: true, endsAt: true, status: true },
        },
      },
    })

    if (!os) throw new NotFoundException('Ordem de serviço não encontrada')
    return os
  }

  async create(params: {
    orgId: string
    createdBy: string | null
    personId: string | null
    customerId: string
    title: string
    description?: string
    priority?: number
    scheduledFor?: string
    appointmentId?: string
    assignedToPersonId?: string
    amountCents?: number
    dueDate?: string
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')
    if (!params.customerId) {
      throw new BadRequestException('customerId é obrigatório')
    }

    const title = normalizeText(params.title)
    if (!title) throw new BadRequestException('title é obrigatório')

    const description = normalizeText(params.description)

    const priority =
      typeof params.priority === 'number' && Number.isFinite(params.priority)
        ? Math.min(5, Math.max(1, Math.floor(params.priority)))
        : 2

    let scheduledFor: Date | null = null
    if (typeof params.scheduledFor === 'string' && params.scheduledFor.trim()) {
      const d = new Date(params.scheduledFor.trim())
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('scheduledFor inválido (use ISO)')
      }
      scheduledFor = d
    }

    let dueDateValue: Date | null = null
    if (typeof params.dueDate === 'string' && params.dueDate.trim()) {
      const d = new Date(params.dueDate.trim())
      if (Number.isNaN(d.getTime())) {
        throw new BadRequestException('dueDate inválido (use ISO)')
      }
      dueDateValue = d
    }

    const amountCents =
      typeof params.amountCents === 'number' && Number.isFinite(params.amountCents)
        ? Math.floor(params.amountCents)
        : null

    if (amountCents !== null && amountCents <= 0) {
      throw new BadRequestException('amountCents inválido')
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: params.customerId, orgId: params.orgId },
      select: { id: true, name: true },
    })
    if (!customer) throw new BadRequestException('Cliente inválido para este org')

    if (params.appointmentId) {
      const appt = await this.prisma.appointment.findFirst({
        where: { id: params.appointmentId, orgId: params.orgId },
        select: { id: true, customerId: true },
      })
      if (!appt) {
        throw new BadRequestException('appointmentId inválido para este org')
      }
      if (appt.customerId !== params.customerId) {
        throw new BadRequestException(
          'appointmentId não pertence ao mesmo customerId',
        )
      }
    }

    if (params.assignedToPersonId) {
      const p = await this.prisma.person.findFirst({
        where: {
          id: params.assignedToPersonId,
          orgId: params.orgId,
          active: true,
        },
        select: { id: true },
      })
      if (!p) {
        throw new BadRequestException('assignedToPersonId inválido para este org')
      }
    }

    const created = await this.prisma.serviceOrder.create({
      data: {
        orgId: params.orgId,
        customerId: params.customerId,
        appointmentId: params.appointmentId ?? null,
        assignedToPersonId: params.assignedToPersonId ?? null,
        title,
        description,
        priority,
        scheduledFor,
        amountCents,
        dueDate: dueDateValue,
        status: params.assignedToPersonId ? 'ASSIGNED' : 'OPEN',
      },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
        appointment: {
          select: { id: true, startsAt: true, endsAt: true, status: true },
        },
      },
    })

    const context = `O.S. criada: ${created.title} (${created.customer.name})`

    await this.timeline.log({
      orgId: params.orgId,
      personId: params.personId,
      action: 'SERVICE_ORDER_CREATED',
      description: context,
      metadata: {
        serviceOrderId: created.id,
        customerId: created.customerId,
        appointmentId: created.appointmentId,
        assignedToPersonId: created.assignedToPersonId,
        status: created.status,
        priority: created.priority,
        scheduledFor: created.scheduledFor,
        amountCents: created.amountCents ?? null,
        dueDate: created.dueDate ?? null,
        actorUserId: params.createdBy,
        actorPersonId: params.personId,
        createdBy: params.createdBy,
      },
    })

    await this.audit.log({
      orgId: params.orgId,
      action: AUDIT_ACTIONS.SERVICE_ORDER_CREATED,
      actorUserId: params.createdBy,
      actorPersonId: params.personId,
      personId: params.personId,
      entityType: 'SERVICE_ORDER',
      entityId: created.id,
      context,
      metadata: {
        serviceOrderId: created.id,
        customerId: created.customerId,
        appointmentId: created.appointmentId,
        assignedToPersonId: created.assignedToPersonId,
        status: created.status,
        priority: created.priority,
        scheduledFor: created.scheduledFor,
        amountCents: created.amountCents ?? null,
        dueDate: created.dueDate ?? null,
      },
    })

    await this.syncOperationalForPeople(params.orgId, [created.assignedToPersonId])
    await this.onboardingService.completeOnboardingStep(params.orgId, 'createService')

    return created
  }

  async checkAndNotifyOverdueServiceOrders() {
    const now = new Date()

    const overdueServiceOrders = await this.prisma.serviceOrder.findMany({
      where: {
        scheduledFor: { lt: now },
        status: { notIn: [ServiceOrderStatus.DONE, ServiceOrderStatus.CANCELED] },
      },
      include: { customer: true, assignedTo: true },
    })

    for (const so of overdueServiceOrders) {
      const message = `Serviço #${so.id} (${so.title}) para ${so.customer.name} está atrasado.`
      await this.notificationsService.createNotification(
        so.orgId,
        'SERVICE_OVERDUE',
        message,
        so.assignedToPersonId ? (so.assignedTo as any)?.userId : null,
        { serviceOrderId: so.id, customerId: so.customerId },
      )
    }
  }

  async update(params: {
    orgId: string
    updatedBy: string | null
    personId: string | null
    id: string
    data: {
      title?: string
      description?: string
      priority?: number
      scheduledFor?: string
      status?: ServiceOrderStatus
      assignedToPersonId?: string | null
      amountCents?: number
      dueDate?: string
    }
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')
    if (!params.id) throw new BadRequestException('id é obrigatório')

    const existing = await this.prisma.serviceOrder.findFirst({
      where: { id: params.id, orgId: params.orgId },
      select: {
        id: true,
        status: true,
        assignedToPersonId: true,
        customerId: true,
        amountCents: true,
        dueDate: true,
      },
    })
    if (!existing) throw new NotFoundException('Ordem de serviço não encontrada')

    const amountCents = params.data.amountCents
    const dueDate = params.data.dueDate

    const patch: any = {}

    if (typeof params.data.title === 'string') {
      const v = normalizeText(params.data.title)
      if (!v) throw new BadRequestException('title inválido')
      patch.title = v
    }

    if (typeof params.data.description === 'string') {
      patch.description = normalizeText(params.data.description)
    }

    if (typeof params.data.priority === 'number') {
      if (!Number.isFinite(params.data.priority)) {
        throw new BadRequestException('priority inválida')
      }
      patch.priority = Math.min(5, Math.max(1, Math.floor(params.data.priority)))
    }

    if (typeof params.data.scheduledFor === 'string') {
      const s = params.data.scheduledFor.trim()
      if (!s) {
        patch.scheduledFor = null
      } else {
        const d = new Date(s)
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('scheduledFor inválido (use ISO)')
        }
        patch.scheduledFor = d
      }
    }

    if (params.data.amountCents !== undefined) {
      if (
        typeof params.data.amountCents !== 'number' ||
        !Number.isFinite(params.data.amountCents)
      ) {
        throw new BadRequestException('amountCents inválido')
      }

      const normalizedAmount = Math.floor(params.data.amountCents)
      if (normalizedAmount <= 0) {
        throw new BadRequestException('amountCents inválido')
      }

      patch.amountCents = normalizedAmount
    }

    if (params.data.dueDate !== undefined) {
      const s = (params.data.dueDate ?? '').trim()
      if (!s) {
        patch.dueDate = null
      } else {
        const d = new Date(s)
        if (Number.isNaN(d.getTime())) {
          throw new BadRequestException('dueDate inválido (use ISO)')
        }
        patch.dueDate = d
      }
    }

    if (typeof params.data.status === 'string') {
      if (!isStatus(params.data.status)) {
        throw new BadRequestException('status inválido')
      }
      if (!this.canTransition(existing.status, params.data.status)) {
        throw new BadRequestException(
          `Transição inválida de ${existing.status} para ${params.data.status}`,
        )
      }
      patch.status = params.data.status
    }

    if (params.data.assignedToPersonId !== undefined) {
      const v = params.data.assignedToPersonId
      if (v === null) {
        patch.assignedToPersonId = null
      } else if (typeof v === 'string' && v.trim()) {
        const p = await this.prisma.person.findFirst({
          where: { id: v.trim(), orgId: params.orgId, active: true },
          select: { id: true },
        })
        if (!p) {
          throw new BadRequestException('assignedToPersonId inválido para este org')
        }
        patch.assignedToPersonId = v.trim()
      } else {
        throw new BadRequestException('assignedToPersonId inválido')
      }
    }

    if (patch.assignedToPersonId && !patch.status && existing.status === 'OPEN') {
      patch.status = 'ASSIGNED'
    }

    if (patch.status === 'IN_PROGRESS' && existing.status !== 'IN_PROGRESS') {
      patch.startedAt = new Date()
    }

    if (patch.status === 'DONE' && existing.status !== 'DONE') {
      patch.finishedAt = new Date()
      patch.startedAt = patch.startedAt ?? new Date()
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Nenhum campo para atualizar')
    }

    const result = await this.prisma.serviceOrder.updateMany({
      where: { id: params.id, orgId: params.orgId },
      data: patch,
    })
    if (result.count === 0) {
      throw new NotFoundException('Ordem de serviço não encontrada')
    }

    const updated = await this.prisma.serviceOrder.findFirst({
      where: { id: params.id, orgId: params.orgId },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
        appointment: {
          select: { id: true, startsAt: true, endsAt: true, status: true },
        },
      },
    })
    if (!updated) throw new NotFoundException('Ordem de serviço não encontrada')

    const statusChanged = !!patch.status && patch.status !== existing.status
    const assignedChanged =
      patch.assignedToPersonId !== undefined &&
      patch.assignedToPersonId !== existing.assignedToPersonId

    await this.timeline.log({
      orgId: params.orgId,
      personId: params.personId,
      action: statusChanged
        ? statusToAction(updated.status)
        : 'SERVICE_ORDER_UPDATED',
      description: `O.S. atualizada: ${updated.title} (${updated.customer.name})`,
      metadata: {
        serviceOrderId: updated.id,
        customerId: updated.customerId,
        appointmentId: updated.appointmentId,
        assignedToPersonId: updated.assignedToPersonId,
        status: updated.status,
        amountCents: updated.amountCents ?? null,
        dueDate: updated.dueDate ?? null,
        actorUserId: params.updatedBy,
        actorPersonId: params.personId,
        updatedBy: params.updatedBy,
        patch,
      },
    })

    let auditAction: string = AUDIT_ACTIONS.SERVICE_ORDER_UPDATED
    if (statusChanged) auditAction = AUDIT_ACTIONS.SERVICE_ORDER_STATUS_CHANGED
    else if (assignedChanged) auditAction = AUDIT_ACTIONS.SERVICE_ORDER_ASSIGNED_CHANGED

    await this.audit.log({
      orgId: params.orgId,
      action: auditAction,
      actorUserId: params.updatedBy,
      actorPersonId: params.personId,
      personId: params.personId,
      entityType: 'SERVICE_ORDER',
      entityId: updated.id,
      context: `O.S. atualizada: ${updated.title} (${updated.customer.name})`,
      metadata: {
        serviceOrderId: updated.id,
        before: {
          status: existing.status,
          assignedToPersonId: existing.assignedToPersonId,
          amountCents: existing.amountCents ?? null,
          dueDate: existing.dueDate ?? null,
        },
        after: {
          status: updated.status,
          assignedToPersonId: updated.assignedToPersonId,
          amountCents: updated.amountCents ?? null,
          dueDate: updated.dueDate ?? null,
        },
        patch,
      },
    })

    if (statusChanged && updated.status === 'DONE') {
      await this.automation.executeTrigger({
        orgId: params.orgId,
        trigger: 'SERVICE_ORDER_COMPLETED',
        payload: {
          serviceOrderId: updated.id,
          customerId: updated.customerId,
          customerPhone: updated.customer?.phone ?? null,
          amountCents: updated.amountCents ?? amountCents,
          entityId: updated.id,
        },
      })

      try {
        await this.finance.ensureChargeForServiceOrderDone({
          orgId: params.orgId,
          serviceOrderId: updated.id,
          customerId: updated.customerId,
          actorUserId: params.updatedBy,
          actorPersonId: params.personId,
          amountCents: updated.amountCents ?? amountCents,
          dueDate: updated.dueDate ?? dueDate ?? null,
        })
      } catch (err) {
        console.warn(
          '[ServiceOrders] Falha ao criar cobrança ao concluir O.S. orgId=%s soId=%s err=%s',
          params.orgId,
          updated.id,
          err instanceof Error ? err.message : String(err),
        )
      }
    }

    const impacted: Array<string | null> = []

    if (assignedChanged) {
      impacted.push(existing.assignedToPersonId ?? null)
      impacted.push(updated.assignedToPersonId ?? null)
    } else if (statusChanged) {
      impacted.push(updated.assignedToPersonId ?? null)
    }

    await this.syncOperationalForPeople(params.orgId, impacted)

    return updated
  }
}
