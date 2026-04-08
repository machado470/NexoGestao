import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { AuditService } from '../audit/audit.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'
import {
  ServiceOrderStatus,
  Prisma,
  WhatsAppEntityType,
  WhatsAppMessageType,
} from '@prisma/client'
import { OperationalStateService } from '../people/operational-state.service'
import { FinanceService } from '../finance/finance.service'
import { AutomationService } from '../automation/automation.service'
import { NotificationsService } from '../notifications/notifications.service'
import { OnboardingService } from '../onboarding/onboarding.service'
import { WhatsAppService } from '../whatsapp/whatsapp.service'
import { AnalyticsService, UsageMetricEvent } from '../analytics/analytics.service'

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

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000)
}

function parseOptionalDate(label: string, value?: string): Date | null {
  if (typeof value !== 'string') return null

  const raw = value.trim()
  if (!raw) return null

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) {
    throw new BadRequestException(`${label} inválido (use ISO)`)
  }

  return parsed
}

function normalizeAmount(value?: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null

  const normalized = Math.floor(value)
  if (normalized <= 0) {
    throw new BadRequestException('amountCents inválido')
  }

  return normalized
}

function resolveDueDateForServiceOrder(params: {
  amountCents: number | null
  dueDate: Date | null
  referenceDate?: Date | null
}): Date | null {
  if (params.dueDate) return params.dueDate
  if (!params.amountCents || params.amountCents <= 0) return null

  const base = params.referenceDate ?? new Date()
  return addDays(base, 3)
}

function isUniqueConflict(err: any): boolean {
  return err?.code === 'P2002'
}

function buildServiceOrderIdempotencyKey(input: {
  orgId: string
  customerId: string
  title: string
  appointmentId?: string
  scheduledFor?: Date | null
  amountCents?: number | null
}): string {
  return [
    'service-order-create',
    input.orgId,
    input.customerId,
    input.title.trim().toLowerCase(),
    input.appointmentId ?? '-',
    input.scheduledFor?.toISOString() ?? '-',
    String(input.amountCents ?? '-'),
  ].join(':')
}

type FinancialSummary = {
  hasCharge: boolean
  chargeId: string | null
  chargeStatus: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED' | null
  chargeAmountCents: number | null
  chargeDueDate: Date | null
  paidAt: Date | null
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
    private readonly whatsApp: WhatsAppService,
    private readonly analytics: AnalyticsService,
  ) {}

  private async enqueueServiceOrderCreatedMessage(params: {
    orgId: string
    customerId: string
    serviceOrderId: string
    customerName: string
    customerPhone: string | null | undefined
    title: string
  }) {
    if (!params.customerPhone) return

    await this.whatsApp.enqueueMessage({
      orgId: params.orgId,
      customerId: params.customerId,
      toPhone: params.customerPhone,
      entityType: WhatsAppEntityType.SERVICE_ORDER,
      entityId: params.serviceOrderId,
      messageType: WhatsAppMessageType.EXECUTION_CONFIRMATION,
      messageKey: `service_order_created:${params.serviceOrderId}`,
      renderedText: `Olá, ${params.customerName}! Sua ordem de serviço "${params.title}" foi criada com sucesso.`,
    })
  }

  private async enqueueServiceOrderDoneMessage(params: {
    orgId: string
    customerId: string
    serviceOrderId: string
    customerName: string
    customerPhone: string | null | undefined
    title: string
  }) {
    if (!params.customerPhone) return

    await this.whatsApp.enqueueMessage({
      orgId: params.orgId,
      customerId: params.customerId,
      toPhone: params.customerPhone,
      entityType: WhatsAppEntityType.SERVICE_ORDER,
      entityId: params.serviceOrderId,
      messageType: WhatsAppMessageType.EXECUTION_CONFIRMATION,
      messageKey: `service_order_done:${params.serviceOrderId}`,
      renderedText: `Olá, ${params.customerName}! Sua ordem de serviço "${params.title}" foi concluída.`,
    })
  }

  private canTransition(from: ServiceOrderStatus, to: ServiceOrderStatus): boolean {
    const allowed: Record<ServiceOrderStatus, ServiceOrderStatus[]> = {
      OPEN: ['ASSIGNED', 'CANCELED'],
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

  private buildFinancialSummary(
    charge?:
      | {
          id: string
          status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED'
          amountCents: number
          dueDate: Date
          paidAt: Date | null
        }
      | null,
  ): FinancialSummary {
    if (!charge) {
      return {
        hasCharge: false,
        chargeId: null,
        chargeStatus: null,
        chargeAmountCents: null,
        chargeDueDate: null,
        paidAt: null,
      }
    }

    return {
      hasCharge: true,
      chargeId: charge.id,
      chargeStatus: charge.status,
      chargeAmountCents: charge.amountCents,
      chargeDueDate: charge.dueDate,
      paidAt: charge.paidAt ?? null,
    }
  }

  private async attachFinancialSummary<T extends { id: string }>(
    orgId: string,
    serviceOrders: T[],
  ): Promise<Array<T & { financialSummary: FinancialSummary }>> {
    if (serviceOrders.length === 0) return []

    const serviceOrderIds = serviceOrders.map((item) => item.id)

    const charges = await this.prisma.charge.findMany({
      where: {
        orgId,
        serviceOrderId: { in: serviceOrderIds },
      },
      select: {
        id: true,
        serviceOrderId: true,
        status: true,
        amountCents: true,
        dueDate: true,
        paidAt: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    })

    const priority: Record<'OVERDUE' | 'PENDING' | 'PAID' | 'CANCELED', number> = {
      OVERDUE: 4,
      PENDING: 3,
      PAID: 2,
      CANCELED: 1,
    }

    const chargeByServiceOrderId = new Map<
      string,
      {
        id: string
        status: 'PENDING' | 'PAID' | 'OVERDUE' | 'CANCELED'
        amountCents: number
        dueDate: Date
        paidAt: Date | null
      }
    >()

    for (const charge of charges) {
      if (!charge.serviceOrderId) continue

      const current = chargeByServiceOrderId.get(charge.serviceOrderId)
      if (!current) {
        chargeByServiceOrderId.set(charge.serviceOrderId, {
          id: charge.id,
          status: charge.status as any,
          amountCents: charge.amountCents,
          dueDate: charge.dueDate,
          paidAt: charge.paidAt ?? null,
        })
        continue
      }

      if (
        priority[charge.status as keyof typeof priority] >
        priority[current.status as keyof typeof priority]
      ) {
        chargeByServiceOrderId.set(charge.serviceOrderId, {
          id: charge.id,
          status: charge.status as any,
          amountCents: charge.amountCents,
          dueDate: charge.dueDate,
          paidAt: charge.paidAt ?? null,
        })
      }
    }

    return serviceOrders.map((serviceOrder) => ({
      ...serviceOrder,
      financialSummary: this.buildFinancialSummary(
        chargeByServiceOrderId.get(serviceOrder.id) ?? null,
      ),
    }))
  }

  async list(
    orgId: string,
    filters: {
      status?: ServiceOrderStatus
      customerId?: string
      assignedToPersonId?: string
      from?: string
      to?: string
      page?: number
      limit?: number
      search?: string
    },
  ) {
    if (!orgId) throw new BadRequestException('orgId é obrigatório')

    const page = Number(filters.page) || 1
    const limit = Math.min(Number(filters.limit) || 20, 100)
    const skip = (page - 1) * limit

    const from = parseOptionalDate('from', filters.from)
    const to = parseOptionalDate('to', filters.to)

    if (from && to && from.getTime() > to.getTime()) {
      throw new BadRequestException('intervalo inválido: from não pode ser maior que to')
    }

    const where: Prisma.ServiceOrderWhereInput = { orgId }

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

    if (from || to) {
      where.scheduledFor = {}
      if (from) where.scheduledFor.gte = from
      if (to) where.scheduledFor.lte = to
    }

    if (filters.search) {
      const s = String(filters.search)
      where.OR = [
        { title: { contains: s, mode: 'insensitive' } },
        { description: { contains: s, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { name: { contains: s, mode: 'insensitive' } },
              { email: { contains: s, mode: 'insensitive' } },
              { phone: { contains: s, mode: 'insensitive' } },
            ],
          },
        },
      ]
    }

    const [rows, total] = await Promise.all([
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

    const data = await this.attachFinancialSummary(orgId, rows)

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

    const [enriched] = await this.attachFinancialSummary(orgId, [os])

    if (!enriched) {
      throw new NotFoundException('Ordem de serviço não encontrada')
    }

    return enriched
  }

  async create(params: {
    orgId: string
    createdBy: string | null
    personId: string | null
    customerId: string
    title: string
    description?: string
    priority?: number
    assignedToPersonId?: string
    appointmentId?: string
    scheduledFor?: string
    amountCents?: number
    dueDate?: string
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')
    if (!params.customerId) throw new BadRequestException('customerId é obrigatório')

    const title = (params.title ?? '').trim()
    if (!title) throw new BadRequestException('Título é obrigatório')

    const description = normalizeText(params.description)
    const scheduledFor = parseOptionalDate('scheduledFor', params.scheduledFor)
    const amountCents = normalizeAmount(params.amountCents)
    const dueDate = parseOptionalDate('dueDate', params.dueDate)
    const priority = typeof params.priority === 'number' ? params.priority : 2

    const customer = await this.prisma.customer.findFirst({
      where: { id: params.customerId, orgId: params.orgId },
      select: { id: true, name: true },
    })
    if (!customer) throw new BadRequestException('Cliente inválido')

    if (params.assignedToPersonId) {
      const person = await this.prisma.person.findFirst({
        where: { id: params.assignedToPersonId, orgId: params.orgId },
        select: { id: true },
      })
      if (!person) throw new BadRequestException('Responsável inválido')
    }

    if (params.appointmentId) {
      const appt = await this.prisma.appointment.findFirst({
        where: { id: params.appointmentId, orgId: params.orgId },
        select: { id: true },
      })
      if (!appt) throw new BadRequestException('Agendamento inválido')
    }

    const idempotencyKey = buildServiceOrderIdempotencyKey({
      orgId: params.orgId,
      customerId: params.customerId,
      title,
      appointmentId: params.appointmentId,
      scheduledFor,
      amountCents,
    })

    let created: any
    try {
      created = await this.prisma.serviceOrder.create({
        data: {
          orgId: params.orgId,
          customerId: params.customerId,
          idempotencyKey,
          title,
          description,
          priority,
          assignedToPersonId: params.assignedToPersonId ?? null,
          appointmentId: params.appointmentId ?? null,
          scheduledFor,
          amountCents,
          dueDate,
          status: params.assignedToPersonId ? 'ASSIGNED' : 'OPEN',
        },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      })
    } catch (err) {
      if (!isUniqueConflict(err)) throw err
      const existing = await this.prisma.serviceOrder.findFirst({
        where: { orgId: params.orgId, idempotencyKey },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      })
      if (!existing) throw err
      return existing
    }

    const context = `Ordem de serviço criada: ${created.title} (cliente: ${created.customer.name})`

    await this.timeline.log({
      orgId: params.orgId,
      personId: params.personId,
      action: 'SERVICE_ORDER_CREATED',
      description: context,
      customerId: created.customerId,
      serviceOrderId: created.id,
      appointmentId: created.appointmentId ?? null,
      metadata: {
        actorUserId: params.createdBy,
        actorPersonId: params.personId,
        createdBy: params.createdBy,
        title: created.title,
        status: created.status,
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
        title: created.title,
        status: created.status,
      },
    })

    await this.notificationsService.createNotification(
      created.orgId,
      'CUSTOMER_CREATED' as any,
      `Nova O.S. "${created.title}" criada para ${created.customer.name}.`,
      params.createdBy,
      { serviceOrderId: created.id },
    )

    await this.enqueueServiceOrderCreatedMessage({
      orgId: created.orgId,
      customerId: created.customerId,
      serviceOrderId: created.id,
      customerName: created.customer.name,
      customerPhone: created.customer.phone,
      title: created.title,
    })

    await this.onboardingService.completeOnboardingStep(
      params.orgId,
      'createService' as any,
    )

    void this.analytics.track({
      orgId: params.orgId,
      userId: params.createdBy ?? undefined,
      event:
        (UsageMetricEvent as any)?.SERVICE_ORDER_CREATED ??
        (UsageMetricEvent as any)?.LOGIN,
      metadata: {
        source: 'service_order_create',
        serviceOrderId: created.id,
        customerId: created.customerId,
      },
    })

    await this.syncOperationalForPeople(params.orgId, [
      params.personId,
      params.assignedToPersonId,
    ])

    return created
  }

  async update(params: {
    orgId: string
    updatedBy: string | null
    personId: string | null
    id: string
    data: {
      title?: string
      description?: string
      assignedToPersonId?: string
      status?: ServiceOrderStatus
      scheduledFor?: string
      amountCents?: number
    }
  }) {
    if (!params.orgId) throw new BadRequestException('orgId é obrigatório')
    if (!params.id) throw new BadRequestException('id é obrigatório')

    const before = await this.prisma.serviceOrder.findFirst({
      where: { id: params.id, orgId: params.orgId },
    })
    if (!before) throw new NotFoundException('Ordem de serviço não encontrada')

    const data: any = {}

    if (params.data.title !== undefined) {
      const v = (params.data.title ?? '').trim()
      if (!v) throw new BadRequestException('Título inválido')
      data.title = v
    }

    if (params.data.description !== undefined) {
      data.description = normalizeText(params.data.description)
    }

    if (params.data.assignedToPersonId !== undefined) {
      if (params.data.assignedToPersonId) {
        const person = await this.prisma.person.findFirst({
          where: { id: params.data.assignedToPersonId, orgId: params.orgId },
          select: { id: true },
        })
        if (!person) throw new BadRequestException('Responsável inválido')
        data.assignedToPersonId = params.data.assignedToPersonId
      } else {
        data.assignedToPersonId = null
      }
    }

    if (params.data.status !== undefined) {
      if (!isStatus(params.data.status)) {
        throw new BadRequestException('status inválido')
      }
      if (!this.canTransition(before.status, params.data.status)) {
        throw new BadRequestException(
          `Transição de status inválida: ${before.status} -> ${params.data.status}`,
        )
      }
      data.status = params.data.status
    }

    if (params.data.scheduledFor !== undefined) {
      data.scheduledFor = parseOptionalDate('scheduledFor', params.data.scheduledFor)
    }

    if (params.data.amountCents !== undefined) {
      data.amountCents = normalizeAmount(params.data.amountCents)
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('Nenhum campo para atualizar')
    }

    const updated = await this.prisma.serviceOrder.update({
      where: { id: params.id },
      data,
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        assignedTo: { select: { id: true, name: true } },
      },
    })

    const context = `Ordem de serviço atualizada: ${updated.title}`

    await this.timeline.log({
      orgId: params.orgId,
      personId: params.personId,
      action: statusToAction(updated.status),
      description: context,
      customerId: updated.customerId,
      serviceOrderId: updated.id,
      appointmentId: updated.appointmentId ?? null,
      metadata: {
        actorUserId: params.updatedBy,
        actorPersonId: params.personId,
        updatedBy: params.updatedBy,
        patch: data,
      },
    })

    if (data.status === 'DONE' && before.status !== 'DONE') {
      void this.analytics.track({
        orgId: params.orgId,
        userId: params.updatedBy ?? undefined,
        event:
          (UsageMetricEvent as any)?.SERVICE_ORDER_DONE ??
          (UsageMetricEvent as any)?.LOGIN,
        metadata: {
          source: 'service_order_update',
          serviceOrderId: updated.id,
          customerId: updated.customerId,
        },
      })

      if (updated.amountCents && updated.amountCents > 0) {
        await this.finance.ensureChargeForServiceOrderDone({
          orgId: params.orgId,
          serviceOrderId: updated.id,
          customerId: updated.customerId,
          amountCents: updated.amountCents,
          actorUserId: params.updatedBy,
        })
      }

      await this.automation.executeTrigger({
        orgId: params.orgId,
        trigger: 'SERVICE_ORDER_DONE',
        payload: {
          serviceOrderId: updated.id,
          customerId: updated.customerId,
          customerPhone: updated.customer?.phone ?? null,
          title: updated.title,
          status: updated.status,
          entityId: updated.id,
        },
      })

      await this.enqueueServiceOrderDoneMessage({
        orgId: updated.orgId,
        customerId: updated.customerId,
        serviceOrderId: updated.id,
        customerName: updated.customer?.name ?? 'cliente',
        customerPhone: updated.customer?.phone,
        title: updated.title,
      })
    }

    await this.audit.log({
      orgId: params.orgId,
      action: AUDIT_ACTIONS.SERVICE_ORDER_UPDATED,
      actorUserId: params.updatedBy,
      actorPersonId: params.personId,
      personId: params.personId,
      entityType: 'SERVICE_ORDER',
      entityId: updated.id,
      context,
      metadata: {
        serviceOrderId: updated.id,
        before: {
          title: before.title,
          status: before.status,
          assignedToPersonId: before.assignedToPersonId,
        },
        after: {
          title: updated.title,
          status: updated.status,
          assignedToPersonId: updated.assignedToPersonId,
        },
        patch: data,
      },
    })

    await this.syncOperationalForPeople(params.orgId, [
      params.personId,
      before.assignedToPersonId,
      updated.assignedToPersonId,
    ])

    return updated
  }

  async generateCharge(params: {
    orgId: string
    actorUserId: string | null
    serviceOrderId: string
    amountCents?: number
    dueDate?: string
  }) {
    const os = await this.prisma.serviceOrder.findFirst({
      where: { id: params.serviceOrderId, orgId: params.orgId },
    })

    if (!os) throw new NotFoundException('Ordem de serviço não encontrada')

    const amountCents = normalizeAmount(params.amountCents) ?? os.amountCents
    if (!amountCents || amountCents <= 0) {
      throw new BadRequestException('Valor da O.S. não definido ou inválido')
    }

    const dueDate = resolveDueDateForServiceOrder({
      amountCents,
      dueDate: parseOptionalDate('dueDate', params.dueDate),
    })

    const result = await this.finance.ensureChargeForServiceOrderDone({
      orgId: params.orgId,
      serviceOrderId: os.id,
      customerId: os.customerId,
      amountCents,
      dueDate,
      actorUserId: params.actorUserId,
    })

    return result
  }
}
