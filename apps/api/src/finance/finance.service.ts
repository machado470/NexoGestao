import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { AuditService } from '../audit/audit.service'
import { NotificationsService } from '../notifications/notifications.service'
import { OnboardingService } from '../onboarding/onboarding.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'
import { $Enums, Prisma } from '@prisma/client'
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

type DbClient = PrismaService | any

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
      include: { customer: { select: { id: true, phone: true } } },
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
        metadata: { chargeId: charge.id, customerId: charge.customerId },
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
      },
    })
  }

  async sendPaymentReminder(input: {
    orgId: string
    customerId: string
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
      entityId: input.customerId,
      messageType: 'PAYMENT_REMINDER',
      messageKey: `charge:reminder:${input.customerId}:${Date.now()}`,
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
    tx?: any
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

    const run = async (tx: any) => {
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

      let created: { id: string }
      try {
        created = await tx.charge.create({
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
      } catch (error) {
        if (!isUniqueViolation(error)) throw error

        const concurrent = await tx.charge.findFirst({
          where: {
            orgId: input.orgId,
            serviceOrderId: input.serviceOrderId,
          },
          select: { id: true },
        })

        if (!concurrent) throw error
        return { created: false, chargeId: concurrent.id }
      }

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

    await this.notificationsService.createNotification(
      input.orgId,
      'CUSTOMER_CREATED',
      `Cobrança de ${amountCents / 100} para O.S. ${input.serviceOrderId} criada. Vencimento: ${finalDueDate.toLocaleDateString()}.`,
      input.actorUserId ?? null,
      { chargeId: result.chargeId, serviceOrderId: input.serviceOrderId },
    )

    const chargeWithCustomer = await this.prisma.charge.findFirst({
      where: { id: result.chargeId, orgId: input.orgId },
      include: { customer: { select: { phone: true } } },
    })

    if (chargeWithCustomer?.customer?.phone) {
      await this.whatsapp.queueMessage({
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

    return this.prisma.$transaction(async (tx) => {
      const charge = await tx.charge.findFirst({
        where: { id: input.chargeId, orgId: input.orgId },
        select: { id: true, amountCents: true, status: true },
      })

      if (!charge) throw new NotFoundException('Cobrança não encontrada')
      if (charge.status === 'PAID') return { alreadyPaid: true }
      if (charge.status !== 'PENDING') {
        throw new BadRequestException('Transição inválida: somente PENDING → PAID')
      }

      if (input.amountCents !== charge.amountCents) {
        throw new BadRequestException('Valor do pagamento diferente da cobrança')
      }

      let payment: { id: string }
      try {
        payment = await tx.payment.create({
          data: {
            orgId: input.orgId,
            chargeId: charge.id,
            amountCents: input.amountCents,
            method: input.method,
            paidAt: now,
          },
          select: { id: true },
        })
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
        return { alreadyPaid: true }
      }

      const transition = await tx.charge.updateMany({
        where: { id: charge.id, orgId: input.orgId, status: 'PENDING' },
        data: {
          status: 'PAID',
          paidAt: now,
        },
      })

      if (transition.count === 0) {
        return { alreadyPaid: true }
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
            amountCents: input.amountCents,
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

      await this.notificationsService.createNotification(
        input.orgId,
        'PAYMENT_RECEIVED',
        `Pagamento de ${input.amountCents / 100} recebido para cobrança ${charge.id}.`,
        input.actorUserId,
        { chargeId: charge.id, paymentId: payment.id },
      )

      const paidCharge = await this.prisma.charge.findFirst({
        where: { id: charge.id, orgId: input.orgId },
        include: { customer: { select: { id: true, phone: true } } },
      })
      if (paidCharge?.customer?.phone) {
        await this.whatsapp.queueMessage({
          orgId: input.orgId,
          customerId: paidCharge.customer.id,
          toPhone: paidCharge.customer.phone,
          entityType: 'CHARGE',
          entityId: charge.id,
          messageType: 'RECEIPT',
          messageKey: `charge:${charge.id}:receipt:${payment.id}`,
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
          chargeId: charge.id,
          paymentId: payment.id,
          amountCents: input.amountCents,
        }),
      )
      return { paymentId: payment.id }
    })
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

  async createCharge(input: any) {
    const { orgId, actorUserId, actorPersonId, ...data } = input

    const charge = await this.prisma.charge.create({
      data: {
        orgId,
        customerId: data.customerId,
        amountCents: data.amountCents,
        dueDate: new Date(data.dueDate),
        notes: data.notes,
        serviceOrderId: data.serviceOrderId,
        status: 'PENDING',
      },
    })

    await this.audit.log({
      orgId,
      action: AUDIT_ACTIONS.CHARGE_CREATED,
      actorUserId,
      actorPersonId,
      entityType: 'CHARGE',
      entityId: charge.id,
      context: 'Cobrança criada manualmente',
      metadata: { requestId: this.requestContext.requestId },
    })

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

  async updateCharge(input: any) {
    const { id, orgId, actorUserId, actorPersonId, ...data } = input

    const updated = await this.prisma.$transaction(async (tx) => {
      const ownership = await tx.charge.findFirst({
        where: { id, orgId },
        select: { id: true },
      })

      if (!ownership) throw new NotFoundException('Cobrança não encontrada')

      const result = await tx.charge.updateMany({
        where: { id, orgId },
        data: {
          amountCents: data.amountCents,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
          status: data.status,
          notes: data.notes,
        },
      })

      if (result.count === 0) throw new NotFoundException('Cobrança não encontrada')

      return tx.charge.findFirst({ where: { id, orgId } })
    })

    await this.audit.log({
      orgId,
      action: AUDIT_ACTIONS.CHARGE_UPDATED,
      actorUserId,
      actorPersonId,
      entityType: 'CHARGE',
      entityId: id,
      context: 'Cobrança atualizada manualmente',
    })

    return updated
  }

  async deleteCharge(orgId: string, id: string) {
    await this.prisma.$transaction(async (tx) => {
      const ownership = await tx.charge.findFirst({
        where: { id, orgId },
        select: { id: true },
      })

      if (!ownership) throw new NotFoundException('Cobrança não encontrada')

      const deleted = await tx.charge.deleteMany({
        where: { id, orgId },
      })

      if (deleted.count === 0) throw new NotFoundException('Cobrança não encontrada')
    })
  }
}
