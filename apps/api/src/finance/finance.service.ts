import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { $Enums, Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { AuditService } from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import { OnboardingService } from '../onboarding/onboarding.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'
import { ChargesQueryDto } from './dto/charges-query.dto'
import { WhatsAppService } from '../whatsapp/whatsapp.service'
import { RiskService } from '../risk/risk.service'
import { RequestContextService } from '../common/context/request-context.service'
import { MetricsService } from '../common/metrics/metrics.service'
import { AutomationService } from '../automation/automation.service'
import { QueueService } from '../queue/queue.service'
import { QUEUE_NAMES } from '../queue/queue.constants'

function isUuidLike(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  )
}

type DbClient = PrismaService | Prisma.TransactionClient

type CreateChargeInput = {
  orgId: string
  actorUserId: string | null
  actorPersonId: string | null
  customerId: string
  serviceOrderId?: string | null
  amountCents: number
  dueDate: Date | string
  notes?: string | null
}

type UpdateChargeInput = {
  id: string
  orgId: string
  actorUserId: string | null
  actorPersonId: string | null
  amountCents?: number
  dueDate?: string
  status?: 'CANCELED'
  notes?: string
}

type DeleteChargeInput = {
  id: string
  orgId: string
  actorUserId: string | null
  actorPersonId: string | null
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
  )
}

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name)

  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly audit: AuditService,
    private readonly notificationsService: NotificationsService,
    private readonly onboardingService: OnboardingService,
    private readonly whatsapp: WhatsAppService,
    private readonly risk: RiskService,
    private readonly requestContext: RequestContextService,
    private readonly metrics: MetricsService,
    private readonly automation: AutomationService,
    private readonly queueService: QueueService,
  ) {}

  async automateOverdueLifecycle(orgId: string) {
    const now = new Date()
    const overdue = await this.prisma.charge.findMany({
      where: { orgId, status: 'PENDING', dueDate: { lt: now } },
      include: {
        customer: { select: { id: true, phone: true } },
      },
      take: 200,
    })

    for (const charge of overdue) {
      await this.prisma.charge.update({
        where: { id: charge.id },
        data: { status: 'OVERDUE' },
      })

      await this.timeline.log({
        orgId,
        action: 'CHARGE_OVERDUE',
        description: 'Cobrança movida para vencida (automação)',
        metadata: {
          chargeId: charge.id,
          customerId: charge.customerId,
          serviceOrderId: charge.serviceOrderId ?? null,
          amountCents: charge.amountCents,
          dueDate: charge.dueDate?.toISOString?.() ?? null,
          status: 'OVERDUE',
        },
      })

      if (charge.customer?.phone) {
        await this.whatsapp.enqueueMessage({
          orgId,
          customerId: charge.customerId,
          toPhone: charge.customer.phone,
          entityType: 'CHARGE',
          entityId: charge.id,
          messageType: 'PAYMENT_REMINDER',
          messageKey: `charge:${charge.id}:overdue`,
          renderedText:
            'Sua cobrança está em atraso. Regularize para evitar bloqueios.',
        })
      }

      await this.risk.recalculateCustomerOperationalRisk(
        orgId,
        charge.customerId,
        'CHARGE_OVERDUE',
      )

      await this.automation.executeTrigger({
        orgId,
        trigger: 'PAYMENT_OVERDUE',
        payload: {
          chargeId: charge.id,
          customerId: charge.customerId,
          customerPhone: charge.customer?.phone ?? null,
          amountCents: charge.amountCents,
          dueDate: charge.dueDate,
          entityId: charge.id,
        },
      })
    }

    return { updated: overdue.length }
  }

  async enqueueCreateCharge(input: {
    orgId: string
    customerId: string
    serviceOrderId?: string | null
    amountCents: number
    dueDate: Date
    title?: string
    description?: string | null
  }) {
    return this.queueService.addJob(QUEUE_NAMES.FINANCE, 'create-charge', input)
  }

  async createAutomationCharge(input: {
    orgId: string
    customerId: string
    serviceOrderId?: string | null
    amountCents: number
    dueDate: Date | string
    title?: string
    description?: string | null
  }) {
    return this.prisma.charge.create({
      data: {
        orgId: input.orgId,
        customerId: input.customerId,
        serviceOrderId: input.serviceOrderId ?? null,
        amountCents: input.amountCents,
        dueDate: new Date(input.dueDate),
        status: 'PENDING',
        notes: input.description ?? null,
      },
    })
  }

  async sendPaymentReminder(input: {
    orgId: string
    customerId: string
    chargeId?: string
    chargeTitle?: string
  }) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: input.customerId, orgId: input.orgId },
      select: { phone: true },
    })

    if (!customer?.phone) return

    await this.whatsapp.enqueueMessage({
      orgId: input.orgId,
      customerId: input.customerId,
      toPhone: customer.phone,
      entityType: 'CHARGE',
      entityId: input.chargeId ?? input.customerId,
      messageType: 'PAYMENT_REMINDER',
      messageKey: `charge:reminder:${input.chargeId ?? input.customerId}:${Date.now()}`,
      renderedText: `Lembrete de pagamento: ${input.chargeTitle ?? 'cobrança pendente'}.`,
    })
  }

  async overview(orgId: string) {
    const now = new Date()

    const [openAgg, overdueAgg, paidAgg, nextDue, recentPayments] =
      await Promise.all([
        this.prisma.charge.aggregate({
          where: { orgId, status: 'PENDING', dueDate: { gte: now } },
          _count: { _all: true },
          _sum: { amountCents: true },
        }),
        this.prisma.charge.aggregate({
          where: { orgId, status: 'OVERDUE' },
          _count: { _all: true },
          _sum: { amountCents: true },
        }),
        this.prisma.payment.aggregate({
          where: { orgId },
          _count: { _all: true },
          _sum: { amountCents: true },
        }),
        this.prisma.charge.findMany({
          where: { orgId, status: 'PENDING' },
          orderBy: { dueDate: 'asc' },
          take: 10,
          select: {
            id: true,
            customerId: true,
            amountCents: true,
            status: true,
            dueDate: true,
          },
        }),
        this.prisma.payment.findMany({
          where: { orgId },
          orderBy: { paidAt: 'desc' },
          take: 10,
          select: {
            id: true,
            chargeId: true,
            amountCents: true,
            method: true,
            paidAt: true,
          },
        }),
      ])

    return {
      openCount: openAgg._count._all ?? 0,
      openAmountCents: openAgg._sum.amountCents ?? 0,
      overdueCount: overdueAgg._count._all ?? 0,
      overdueAmountCents: overdueAgg._sum.amountCents ?? 0,
      paidCount: paidAgg._count._all ?? 0,
      paidAmountCents: paidAgg._sum.amountCents ?? 0,
      nextDue,
      recentPayments,
    }
  }

  async ensureChargeForServiceOrderDone(input: {
    orgId: string
    serviceOrderId: string
    customerId?: string
    amountCents?: number
    dueDate?: Date | string | null
    actorUserId?: string | null
    actorPersonId?: string | null
    tx?: Prisma.TransactionClient
  }) {
    const amountCents = input.amountCents ?? 0
    if (amountCents <= 0) return { created: false }

    let dueDate: Date | null = null
    if (input.dueDate instanceof Date) {
      dueDate = input.dueDate
    } else if (typeof input.dueDate === 'string') {
      const parsed = new Date(input.dueDate)
      dueDate = Number.isNaN(parsed.getTime()) ? null : parsed
    }

    const db: DbClient = input.tx ?? this.prisma

    let customerId = input.customerId
    if (!customerId) {
      const so = await db.serviceOrder.findFirst({
        where: { id: input.serviceOrderId, orgId: input.orgId },
        select: { customerId: true },
      })

      if (!so) throw new NotFoundException('ServiceOrder não encontrada')
      if (!so.customerId) {
        throw new BadRequestException('ServiceOrder sem customerId para cobrança')
      }

      customerId = so.customerId
    }

    const finalDueDate =
      dueDate ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

    const run = async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`
        SELECT id
        FROM "ServiceOrder"
        WHERE id = ${input.serviceOrderId} AND "orgId" = ${input.orgId}
        FOR UPDATE
      `

      const existing = await tx.charge.findFirst({
        where: {
          orgId: input.orgId,
          serviceOrderId: input.serviceOrderId,
        },
        select: { id: true, amountCents: true, dueDate: true, status: true },
      })

      if (existing) {
        if (existing.status === 'PENDING' || existing.status === 'OVERDUE') {
          const shouldUpdate =
            existing.amountCents !== amountCents ||
            existing.dueDate.getTime() !== finalDueDate.getTime()

          if (shouldUpdate) {
            await tx.charge.updateMany({
              where: {
                id: existing.id,
                orgId: input.orgId,
                status: { in: ['PENDING', 'OVERDUE'] },
              },
              data: {
                amountCents,
                dueDate: finalDueDate,
              },
            })
          }
        }

        return { created: false, chargeId: existing.id }
      }

      const created = await tx.charge.create({
        data: {
          orgId: input.orgId,
          serviceOrderId: input.serviceOrderId,
          customerId,
          amountCents,
          status: 'PENDING',
          dueDate: finalDueDate,
        },
        select: { id: true },
      })

      await tx.timelineEvent.create({
        data: {
          orgId: input.orgId,
          action: 'CHARGE_CREATED',
          personId: input.actorPersonId ?? null,
          description: 'Cobrança criada automaticamente (O.S. concluída)',
          metadata: {
            chargeId: created.id,
            serviceOrderId: input.serviceOrderId,
            customerId,
            amountCents,
            dueDate: finalDueDate.toISOString(),
            actorUserId: input.actorUserId ?? null,
            actorPersonId: input.actorPersonId ?? null,
            requestId: this.requestContext.requestId,
          },
        },
      })

      await tx.auditEvent.create({
        data: {
          orgId: input.orgId,
          action: AUDIT_ACTIONS.CHARGE_CREATED,
          actorUserId: input.actorUserId ?? null,
          actorPersonId: input.actorPersonId ?? null,
          personId: input.actorPersonId ?? null,
          entityType: 'CHARGE',
          entityId: created.id,
          context: 'Cobrança gerada a partir de ServiceOrder DONE',
          metadata: { requestId: this.requestContext.requestId },
        },
      })

      return { created: true, chargeId: created.id }
    }

    const result = input.tx
      ? await run(input.tx)
      : await this.prisma.$transaction((tx) => run(tx))

    if (!result.created) return result

    const chargeWithCustomer = await this.prisma.charge.findFirst({
      where: { id: result.chargeId, orgId: input.orgId },
      include: { customer: { select: { phone: true } } },
    })

    if (chargeWithCustomer?.customer?.phone) {
      await this.whatsapp.enqueueMessage({
        orgId: input.orgId,
        customerId,
        toPhone: chargeWithCustomer.customer.phone,
        entityType: 'CHARGE',
        entityId: result.chargeId,
        messageType: 'PAYMENT_LINK',
        messageKey: `charge:${result.chargeId}:payment-link`,
        renderedText: 'Cobrança gerada. Entre em contato para pagamento.',
      })
    }

    await this.onboardingService.completeOnboardingStep(input.orgId, 'createCharge')
    this.metrics.increment('chargesCreated')
    this.logger.log(
      JSON.stringify({
        event: 'charge_creation',
        requestId: this.requestContext.requestId,
        userId: input.actorUserId ?? this.requestContext.userId,
        orgId: input.orgId,
        chargeId: result.chargeId,
        source: 'service_order_done',
      }),
    )

    return result
  }

  async payCharge(input: {
    orgId: string
    chargeId: string
    actorUserId: string | null
    actorPersonId: string | null
    method: $Enums.PaymentMethod
    amountCents: number
  }) {
    const now = new Date()

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT id
        FROM "Charge"
        WHERE id = ${input.chargeId} AND "orgId" = ${input.orgId}
        FOR UPDATE
      `

      const charge = await tx.charge.findFirst({
        where: { id: input.chargeId, orgId: input.orgId },
        select: {
          id: true,
          customerId: true,
          serviceOrderId: true,
          amountCents: true,
          dueDate: true,
          status: true,
          customer: { select: { id: true, phone: true } },
        },
      })

      if (!charge) throw new NotFoundException('Cobrança não encontrada')
      if (charge.status === 'PAID') return { alreadyPaid: true as const }

      if (!['PENDING', 'OVERDUE'].includes(charge.status)) {
        throw new BadRequestException(
          'Transição inválida: somente PENDING/OVERDUE → PAID',
        )
      }

      if (input.amountCents !== charge.amountCents) {
        throw new BadRequestException('Valor do pagamento diferente da cobrança')
      }

      const existingPayment = await tx.payment.findFirst({
        where: { orgId: input.orgId, chargeId: charge.id },
        select: { id: true },
      })

      if (existingPayment) {
        await tx.charge.updateMany({
          where: {
            id: charge.id,
            orgId: input.orgId,
            status: { in: ['PENDING', 'OVERDUE'] },
          },
          data: {
            status: 'PAID',
            paidAt: now,
          },
        })

        return {
          alreadyPaid: true as const,
          paymentId: existingPayment.id,
          customerId: charge.customerId,
          customerPhone: charge.customer?.phone ?? null,
        }
      }

      const payment = await tx.payment.create({
        data: {
          orgId: input.orgId,
          chargeId: charge.id,
          amountCents: input.amountCents,
          method: input.method,
          paidAt: now,
        },
        select: { id: true },
      })

      const transition = await tx.charge.updateMany({
        where: {
          id: charge.id,
          orgId: input.orgId,
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        data: {
          status: 'PAID',
          paidAt: now,
        },
      })

      if (transition.count === 0) {
        return {
          alreadyPaid: true as const,
          paymentId: payment.id,
          customerId: charge.customerId,
          customerPhone: charge.customer?.phone ?? null,
        }
      }

      await tx.timelineEvent.create({
        data: {
          orgId: input.orgId,
          action: 'CHARGE_PAID',
          personId: input.actorPersonId ?? null,
          description: `Cobrança paga (${input.method})`,
          metadata: {
            chargeId: charge.id,
            paymentId: payment.id,
            customerId: charge.customerId,
            serviceOrderId: charge.serviceOrderId ?? null,
            amountCents: input.amountCents,
            dueDate: charge.dueDate?.toISOString?.() ?? null,
            status: 'PAID',
            method: input.method,
            actorUserId: input.actorUserId ?? null,
            actorPersonId: input.actorPersonId ?? null,
            requestId: this.requestContext.requestId,
          },
        },
      })

      await tx.auditEvent.create({
        data: {
          orgId: input.orgId,
          action: AUDIT_ACTIONS.CHARGE_PAID,
          actorUserId: input.actorUserId ?? null,
          actorPersonId: input.actorPersonId ?? null,
          personId: input.actorPersonId ?? null,
          entityType: 'CHARGE',
          entityId: charge.id,
          context: 'Cobrança marcada como paga',
          metadata: {
            paymentId: payment.id,
            method: input.method,
            amountCents: input.amountCents,
            requestId: this.requestContext.requestId,
          },
        },
      })

      await tx.auditEvent.create({
        data: {
          orgId: input.orgId,
          action: AUDIT_ACTIONS.PAYMENT_CREATED,
          actorUserId: input.actorUserId ?? null,
          actorPersonId: input.actorPersonId ?? null,
          personId: input.actorPersonId ?? null,
          entityType: 'PAYMENT',
          entityId: payment.id,
          context: 'Pagamento criado',
          metadata: {
            chargeId: charge.id,
            method: input.method,
            amountCents: input.amountCents,
            requestId: this.requestContext.requestId,
          },
        },
      })

      return {
        paymentId: payment.id,
        customerId: charge.customerId,
        customerPhone: charge.customer?.phone ?? null,
      }
    })

    if ('alreadyPaid' in result && result.alreadyPaid) {
      return {
        alreadyPaid: true,
        paymentId: result.paymentId ?? undefined,
      }
    }

    await this.notificationsService.createNotification(
      input.orgId,
      'PAYMENT_RECEIVED',
      `Pagamento de ${input.amountCents / 100} recebido para cobrança ${input.chargeId}.`,
      input.actorUserId ?? undefined,
      { chargeId: input.chargeId, paymentId: result.paymentId },
    )

    if (result.customerPhone) {
      await this.whatsapp.enqueueMessage({
        orgId: input.orgId,
        customerId: result.customerId,
        toPhone: result.customerPhone,
        entityType: 'CHARGE',
        entityId: input.chargeId,
        messageType: 'RECEIPT',
        messageKey: `charge:${input.chargeId}:receipt:${result.paymentId}`,
        renderedText: 'Pagamento recebido com sucesso. Obrigado! ✅',
      })
    }

    this.metrics.increment('paymentsProcessed')
    this.logger.log(
      JSON.stringify({
        event: 'payment_processed',
        requestId: this.requestContext.requestId,
        userId: input.actorUserId ?? this.requestContext.userId,
        orgId: input.orgId,
        chargeId: input.chargeId,
        paymentId: result.paymentId,
        amountCents: input.amountCents,
      }),
    )

    return { paymentId: result.paymentId }
  }

  async exportChargesCsv(orgId: string) {
    const charges = await this.prisma.charge.findMany({
      where: { orgId },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    })

    const header = 'ID,Cliente,Valor (R$),Vencimento,Status,Criado Em\n'
    const rows = charges
      .map((c) => {
        const amount = (c.amountCents / 100).toFixed(2)
        return `"${c.id}","${c.customer?.name || 'N/A'}","${amount}","${c.dueDate.toISOString()}","${c.status}","${c.createdAt.toISOString()}"`
      })
      .join('\n')

    return header + rows
  }

  async listCharges(orgId: string, query?: ChargesQueryDto) {
    const page = query?.page ?? 1
    const rawLimit = query?.limit
    const status = query?.status
    const q = (query?.q ?? '').trim()
    const orderBy = query?.orderBy ?? 'createdAt'
    const direction = query?.direction ?? 'desc'

    let limit = 50
    if (rawLimit !== undefined) {
      if (!Number.isFinite(rawLimit)) {
        throw new BadRequestException('limit inválido')
      }
      if (rawLimit < 1) {
        throw new BadRequestException('limit mínimo é 1')
      }
      if (rawLimit > 100) {
        throw new BadRequestException('limit máximo é 100')
      }
      limit = rawLimit
    }

    if (!Number.isFinite(page) || page < 1) {
      throw new BadRequestException('page inválida')
    }

    const where: any = {
      orgId,
      ...(status ? { status } : {}),
    }

    if (query?.serviceOrderId) {
      where.serviceOrderId = query.serviceOrderId
    }

    if (q) {
      const uuid = isUuidLike(q)

      where.OR = [
        { customer: { name: { contains: q, mode: 'insensitive' } } },
        { customer: { phone: { contains: q } } },
        { serviceOrder: { title: { contains: q, mode: 'insensitive' } } },
      ]

      if (uuid) {
        where.OR.push({ id: { equals: q } })
        where.OR.push({ customerId: { equals: q } })
        where.OR.push({ serviceOrderId: { equals: q } })
      }
    }

    const order: any[] = []
    if (orderBy === 'amountCents') {
      order.push({ amountCents: direction })
      order.push({ createdAt: 'desc' })
      order.push({ id: 'desc' })
    } else if (orderBy === 'dueDate') {
      order.push({ dueDate: direction })
      order.push({ createdAt: 'desc' })
      order.push({ id: 'desc' })
    } else {
      order.push({ createdAt: direction })
      order.push({ id: 'desc' })
    }

    const skip = (page - 1) * limit

    const [total, items] = await Promise.all([
      this.prisma.charge.count({ where }),
      this.prisma.charge.findMany({
        where,
        orderBy: order,
        skip,
        take: limit,
        select: {
          id: true,
          serviceOrderId: true,
          customerId: true,
          amountCents: true,
          status: true,
          dueDate: true,
          paidAt: true,
          createdAt: true,
          notes: true,
          customer: {
            select: { id: true, name: true, phone: true },
          },
          serviceOrder: {
            select: { id: true, title: true, status: true },
          },
        },
      }),
    ])

    const pages = Math.max(1, Math.ceil(total / limit))

    return {
      items,
      meta: {
        page,
        limit,
        total,
        pages,
        orderBy,
        direction,
      },
    }
  }

  async getCharge(orgId: string, id: string) {
    const charge = await this.prisma.charge.findFirst({
      where: { id, orgId },
      select: {
        id: true,
        serviceOrderId: true,
        customerId: true,
        amountCents: true,
        status: true,
        dueDate: true,
        paidAt: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        customer: true,
        serviceOrder: true,
        payments: true,
      },
    })

    if (!charge) throw new NotFoundException('Cobrança não encontrada')
    return charge
  }

  async getChargeStats(orgId: string) {
    const [total, paid, pending, overdue] = await Promise.all([
      this.prisma.charge.aggregate({
        where: { orgId },
        _count: { _all: true },
      }),
      this.prisma.charge.aggregate({
        where: { orgId, status: 'PAID' },
        _count: { _all: true },
        _sum: { amountCents: true },
      }),
      this.prisma.charge.aggregate({
        where: { orgId, status: 'PENDING' },
        _count: { _all: true },
        _sum: { amountCents: true },
      }),
      this.prisma.charge.aggregate({
        where: { orgId, status: 'OVERDUE' },
        _count: { _all: true },
        _sum: { amountCents: true },
      }),
    ])

    return {
      totalCharges: total._count._all ?? 0,
      totalPaid: paid._count._all ?? 0,
      totalPaidAmount: (paid._sum.amountCents ?? 0) / 100,
      totalPending: pending._count._all ?? 0,
      totalPendingAmount: (pending._sum.amountCents ?? 0) / 100,
      totalOverdue: overdue._count._all ?? 0,
      totalOverdueAmount: (overdue._sum.amountCents ?? 0) / 100,
    }
  }

  async getRevenueByMonth(orgId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { orgId },
      select: { amountCents: true, paidAt: true },
      orderBy: { paidAt: 'asc' },
    })

    const monthlyRevenue: Record<string, number> = {}

    payments.forEach((p) => {
      const month = p.paidAt.toISOString().substring(0, 7)
      monthlyRevenue[month] = (monthlyRevenue[month] || 0) + p.amountCents / 100
    })

    return Object.entries(monthlyRevenue).map(([month, revenue]) => ({
      month,
      revenue,
    }))
  }

  async createCharge(input: CreateChargeInput) {
    const { orgId, actorUserId, actorPersonId, ...data } = input

    if (!data.customerId) {
      throw new BadRequestException('customerId é obrigatório')
    }

    if (!Number.isFinite(data.amountCents) || data.amountCents <= 0) {
      throw new BadRequestException('amountCents inválido')
    }

    const dueDate =
      data.dueDate instanceof Date ? data.dueDate : new Date(data.dueDate)

    if (Number.isNaN(dueDate.getTime())) {
      throw new BadRequestException('dueDate inválido')
    }

    const customer = await this.prisma.customer.findFirst({
      where: { id: data.customerId, orgId },
      select: { id: true, name: true },
    })

    if (!customer) {
      throw new BadRequestException('Cliente inválido para este org')
    }

    if (data.serviceOrderId) {
      const serviceOrder = await this.prisma.serviceOrder.findFirst({
        where: { id: data.serviceOrderId, orgId },
        select: { id: true, customerId: true },
      })

      if (!serviceOrder) {
        throw new BadRequestException('serviceOrderId inválido para este org')
      }

      if (serviceOrder.customerId !== data.customerId) {
        throw new BadRequestException(
          'serviceOrderId não pertence ao mesmo customerId',
        )
      }
    }

    const charge = await this.prisma.charge.create({
      data: {
        orgId,
        customerId: data.customerId,
        amountCents: data.amountCents,
        dueDate,
        notes: data.notes ?? null,
        serviceOrderId: data.serviceOrderId ?? null,
        status: 'PENDING',
      },
    })

    await this.timeline.log({
      orgId,
      personId: actorPersonId,
      action: 'CHARGE_CREATED',
      description: 'Cobrança criada manualmente',
      metadata: {
        chargeId: charge.id,
        customerId: charge.customerId,
        serviceOrderId: charge.serviceOrderId,
        amountCents: charge.amountCents,
        dueDate: charge.dueDate.toISOString(),
        actorUserId,
        actorPersonId,
      },
    })

    await this.audit.log({
      orgId,
      action: AUDIT_ACTIONS.CHARGE_CREATED,
      actorUserId,
      actorPersonId,
      personId: actorPersonId,
      entityType: 'CHARGE',
      entityId: charge.id,
      context: 'Cobrança criada manualmente',
      metadata: {
        customerId: charge.customerId,
        serviceOrderId: charge.serviceOrderId,
        amountCents: charge.amountCents,
        dueDate: charge.dueDate.toISOString(),
        requestId: this.requestContext.requestId,
      },
    })

    await this.onboardingService.completeOnboardingStep(orgId, 'createCharge')

    this.metrics.increment('chargesCreated')
    this.logger.log(
      JSON.stringify({
        event: 'charge_creation',
        requestId: this.requestContext.requestId,
        userId: actorUserId,
        orgId,
        chargeId: charge.id,
        source: 'manual',
      }),
    )

    return charge
  }

  async updateCharge(input: UpdateChargeInput) {
    const { id, orgId, actorUserId, actorPersonId, ...data } = input

    const existing = await this.prisma.charge.findFirst({
      where: { id, orgId },
      select: {
        id: true,
        customerId: true,
        serviceOrderId: true,
        amountCents: true,
        dueDate: true,
        status: true,
        notes: true,
      },
    })

    if (!existing) throw new NotFoundException('Cobrança não encontrada')

    if (data.status && data.status !== 'CANCELED') {
      throw new BadRequestException(
        'Atualização manual de status permite apenas CANCELED',
      )
    }

    if (
      existing.status === 'PAID' &&
      (data.amountCents !== undefined ||
        data.dueDate !== undefined ||
        data.status !== undefined)
    ) {
      throw new BadRequestException(
        'Cobrança paga não pode ter valor, vencimento ou status alterados manualmente',
      )
    }

    if (
      existing.status === 'CANCELED' &&
      (data.amountCents !== undefined ||
        data.dueDate !== undefined ||
        data.status !== undefined)
    ) {
      throw new BadRequestException(
        'Cobrança cancelada não pode ter valor, vencimento ou status alterados manualmente',
      )
    }

    if (data.status === 'CANCELED' && existing.status === 'PAID') {
      throw new BadRequestException('Cobrança paga não pode ser cancelada')
    }

    const patch: Prisma.ChargeUpdateManyMutationInput = {}

    let nextAmountCents = existing.amountCents
    let nextDueDate = existing.dueDate
    let nextNotes = existing.notes ?? null
    let nextStatus = existing.status

    if (data.amountCents !== undefined) {
      if (!Number.isFinite(data.amountCents) || data.amountCents <= 0) {
        throw new BadRequestException('amountCents inválido')
      }

      const normalizedAmount = Math.floor(data.amountCents)
      patch.amountCents = normalizedAmount
      nextAmountCents = normalizedAmount
    }

    if (data.dueDate !== undefined) {
      const parsed = new Date(data.dueDate)
      if (Number.isNaN(parsed.getTime())) {
        throw new BadRequestException('dueDate inválido')
      }

      patch.dueDate = parsed
      nextDueDate = parsed
    }

    if (data.notes !== undefined) {
      const normalizedNotes = data.notes?.trim() ? data.notes.trim() : null
      patch.notes = normalizedNotes
      nextNotes = normalizedNotes
    }

    if (data.status === 'CANCELED') {
      patch.status = 'CANCELED'
      nextStatus = 'CANCELED'
    }

    const changed =
      nextAmountCents !== existing.amountCents ||
      nextDueDate.getTime() !== existing.dueDate.getTime() ||
      nextNotes !== (existing.notes ?? null) ||
      nextStatus !== existing.status

    if (!changed) {
      throw new BadRequestException('Nenhuma alteração efetiva informada')
    }

    if (Object.keys(patch).length === 0) {
      throw new BadRequestException('Nenhum campo para atualizar')
    }

    const result = await this.prisma.charge.updateMany({
      where: { id, orgId },
      data: patch,
    })

    if (result.count === 0) throw new NotFoundException('Cobrança não encontrada')

    const updated = await this.prisma.charge.findFirst({
      where: { id, orgId },
    })

    if (!updated) throw new NotFoundException('Cobrança não encontrada')

    await this.timeline.log({
      orgId,
      personId: actorPersonId,
      action: updated.status === 'CANCELED' ? 'CHARGE_CANCELED' : 'CHARGE_UPDATED',
      description:
        updated.status === 'CANCELED'
          ? 'Cobrança cancelada manualmente'
          : 'Cobrança atualizada manualmente',
      metadata: {
        chargeId: updated.id,
        customerId: updated.customerId,
        serviceOrderId: updated.serviceOrderId,
        actorUserId,
        actorPersonId,
        before: {
          amountCents: existing.amountCents,
          dueDate: existing.dueDate.toISOString(),
          status: existing.status,
          notes: existing.notes ?? null,
        },
        after: {
          amountCents: updated.amountCents,
          dueDate: updated.dueDate.toISOString(),
          status: updated.status,
          notes: updated.notes ?? null,
        },
      },
    })

    await this.audit.log({
      orgId,
      action:
        updated.status === 'CANCELED'
          ? AUDIT_ACTIONS.CHARGE_CANCELED
          : AUDIT_ACTIONS.CHARGE_UPDATED,
      actorUserId,
      actorPersonId,
      personId: actorPersonId,
      entityType: 'CHARGE',
      entityId: id,
      context:
        updated.status === 'CANCELED'
          ? 'Cobrança cancelada manualmente'
          : 'Cobrança atualizada manualmente',
      metadata: {
        before: {
          amountCents: existing.amountCents,
          dueDate: existing.dueDate.toISOString(),
          status: existing.status,
          notes: existing.notes ?? null,
        },
        after: {
          amountCents: updated.amountCents,
          dueDate: updated.dueDate.toISOString(),
          status: updated.status,
          notes: updated.notes ?? null,
        },
        requestId: this.requestContext.requestId,
      },
    })

    return updated
  }

  async deleteCharge(input: DeleteChargeInput) {
    const charge = await this.prisma.charge.findFirst({
      where: { id: input.id, orgId: input.orgId },
      select: {
        id: true,
        customerId: true,
        serviceOrderId: true,
        amountCents: true,
        dueDate: true,
        status: true,
      },
    })

    if (!charge) throw new NotFoundException('Cobrança não encontrada')

    if (charge.status === 'PAID') {
      throw new BadRequestException('Cobrança paga não pode ser excluída')
    }

    const paymentCount = await this.prisma.payment.count({
      where: { orgId: input.orgId, chargeId: input.id },
    })

    if (paymentCount > 0) {
      throw new BadRequestException(
        'Cobrança com pagamento registrado não pode ser excluída',
      )
    }

    await this.timeline.log({
      orgId: input.orgId,
      personId: input.actorPersonId,
      action: 'CHARGE_DELETED',
      description: 'Cobrança excluída manualmente',
      metadata: {
        chargeId: charge.id,
        customerId: charge.customerId,
        serviceOrderId: charge.serviceOrderId,
        amountCents: charge.amountCents,
        dueDate: charge.dueDate.toISOString(),
        status: charge.status,
        actorUserId: input.actorUserId,
        actorPersonId: input.actorPersonId,
      },
    })

    await this.audit.log({
      orgId: input.orgId,
      action: AUDIT_ACTIONS.CHARGE_DELETED,
      actorUserId: input.actorUserId,
      actorPersonId: input.actorPersonId,
      personId: input.actorPersonId,
      entityType: 'CHARGE',
      entityId: input.id,
      context: 'Cobrança excluída manualmente',
      metadata: {
        customerId: charge.customerId,
        serviceOrderId: charge.serviceOrderId,
        amountCents: charge.amountCents,
        dueDate: charge.dueDate.toISOString(),
        status: charge.status,
        requestId: this.requestContext.requestId,
      },
    })

    await this.prisma.charge.delete({
      where: { id: input.id },
    })
  }
}
