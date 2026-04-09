import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { $Enums, Prisma, WhatsAppEntityType, WhatsAppMessageType } from '@prisma/client'
import { IdempotencyService } from '../common/idempotency/idempotency.service'
import { chargeTransitions, ensureTransition } from '../common/domain/state-transitions'
import {
  WhatsAppService,
  buildDeterministicMessageKey,
} from '../whatsapp/whatsapp.service'
import { TimelineService } from '../timeline/timeline.service'
import { ChargesQueryDto } from './dto/charges-query.dto'
import { AnalyticsService, UsageMetricEvent } from '../analytics/analytics.service'
import { RequestContextService } from '../common/context/request-context.service'
import { MetricsService } from '../common/metrics/metrics.service'

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name)
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppService,
    private readonly timeline: TimelineService,
    private readonly analytics: AnalyticsService,
    private readonly requestContext: RequestContextService,
    private readonly idempotency: IdempotencyService,
    private readonly metrics: MetricsService,
  ) {}

  private logCritical(params: {
    level: 'log' | 'warn' | 'error'
    action: string
    entityId?: string | null
    message: string
    extra?: Record<string, unknown>
  }) {
    const payload = {
      requestId: this.requestContext.requestId,
      action: params.action,
      entityId: params.entityId ?? null,
      ...params.extra,
      message: params.message,
    }

    const line = JSON.stringify(payload)
    if (params.level === 'error') {
      this.logger.error(line)
      return
    }
    if (params.level === 'warn') {
      this.logger.warn(line)
      return
    }
    this.logger.log(line)
  }

  private async safeTimelineLog(input: Parameters<TimelineService['log']>[0]) {
    try {
      await this.timeline.log(input)
    } catch (error) {
      this.logCritical({
        level: 'error',
        action: input.action,
        entityId:
          input.chargeId ??
          input.serviceOrderId ??
          input.customerId ??
          null,
        message: 'Falha ao registrar timeline',
        extra: {
          orgId: input.orgId,
          error: error instanceof Error ? error.message : String(error),
        },
      })
    }
  }

  private buildChargeCreateIdempotencyKey(input: {
    orgId: string
    customerId: string
    serviceOrderId?: string | null
    amountCents: number
    dueDate: Date
    notes?: string | null
  }): string {
    return [
      'charge-create',
      input.orgId,
      input.customerId,
      input.serviceOrderId ?? '-',
      String(input.amountCents),
      input.dueDate.toISOString(),
      (input.notes ?? '').trim().toLowerCase() || '-',
    ].join(':')
  }

  private async assertServiceOrderEligibleForCharge(params: {
    orgId: string
    serviceOrderId: string
    customerId?: string
  }) {
    const serviceOrder = await this.prisma.serviceOrder.findFirst({
      where: { id: params.serviceOrderId, orgId: params.orgId },
      select: { id: true, customerId: true, status: true },
    })

    if (!serviceOrder) {
      throw new NotFoundException('Ordem de serviço não encontrada para a organização')
    }

    if (params.customerId && serviceOrder.customerId !== params.customerId) {
      throw new BadRequestException('Ordem de serviço não pertence ao cliente informado')
    }

    if (serviceOrder.status === 'CANCELED') {
      throw new BadRequestException('Não é permitido gerar cobrança para O.S. cancelada')
    }

    if (serviceOrder.status !== 'DONE') {
      throw new BadRequestException(
        `Cobrança só pode ser gerada para O.S. finalizada (status atual: ${serviceOrder.status})`,
      )
    }

    return serviceOrder
  }

  private assertChargeStatusTransition(
    from: $Enums.ChargeStatus,
    to: $Enums.ChargeStatus,
  ) {
    if (from === to) return

    ensureTransition(from, to, chargeTransitions, 'charge')
  }

  // =========================
  // OVERVIEW
  // =========================
  async overview(orgId: string) {
    const [openAgg, overdueAgg, paidAgg] = await Promise.all([
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
      this.prisma.payment.aggregate({
        where: { orgId },
        _count: { _all: true },
        _sum: { amountCents: true },
      }),
    ])

    return {
      openCount: openAgg._count._all ?? 0,
      openAmountCents: openAgg._sum.amountCents ?? 0,
      overdueCount: overdueAgg._count._all ?? 0,
      overdueAmountCents: overdueAgg._sum.amountCents ?? 0,
      paidCount: paidAgg._count._all ?? 0,
      paidAmountCents: paidAgg._sum.amountCents ?? 0,
    }
  }

  // =========================
  // LIST
  // =========================
  async listCharges(orgId: string, query?: ChargesQueryDto) {
    const page = Number(query?.page) || 1
    const limit = Number(query?.limit) || 20
    const skip = (page - 1) * limit

    const where: Prisma.ChargeWhereInput = { orgId }

    if (query?.status) {
      where.status = query.status
    }

    if (query?.serviceOrderId) {
      where.serviceOrderId = query.serviceOrderId
    }

    if (query?.q) {
      const q = String(query.q)
      where.OR = [
        { notes: { contains: q, mode: 'insensitive' } },
        {
          customer: {
            OR: [
              { name: { contains: q, mode: 'insensitive' } },
              { email: { contains: q, mode: 'insensitive' } },
              { phone: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      ]
    }

    const [items, total] = await Promise.all([
      this.prisma.charge.findMany({
        where,
        include: {
          customer: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip,
      }),
      this.prisma.charge.count({ where }),
    ])

    return {
      items,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    }
  }

  async getCharge(orgId: string, id: string) {
    const charge = await this.prisma.charge.findFirst({
      where: { id, orgId },
      include: { customer: true, payments: true },
    })

    if (!charge) throw new NotFoundException('Charge não encontrada')
    return charge
  }

  async getPayment(orgId: string, id: string) {
    const payment = await this.prisma.payment.findFirst({
      where: { id, orgId },
      include: {
        charge: {
          include: { customer: true },
        },
      },
    })

    if (!payment) throw new NotFoundException('Pagamento não encontrado')
    return payment
  }

  // =========================
  // CREATE
  // =========================
  async createCharge(input: {
    orgId: string
    customerId: string
    amountCents: number
    dueDate: Date
    actorUserId?: string | null
    notes?: string | null
    serviceOrderId?: string | null
    idempotencyKey?: string | null
  }) {
    this.logCritical({
      level: 'log',
      action: 'CREATE_CHARGE_START',
      entityId: input.serviceOrderId ?? input.customerId,
      message: 'Iniciando createCharge',
      extra: { orgId: input.orgId, customerId: input.customerId },
    })

    const customer = await this.prisma.customer.findFirst({
      where: { id: input.customerId, orgId: input.orgId },
      select: { id: true },
    })
    if (!customer) {
      throw new NotFoundException('Cliente não encontrado para a organização')
    }

    if (input.serviceOrderId) {
      const serviceOrder = await this.assertServiceOrderEligibleForCharge({
        orgId: input.orgId,
        serviceOrderId: input.serviceOrderId,
        customerId: input.customerId,
      })
      if (serviceOrder.customerId !== input.customerId) {
        throw new BadRequestException('serviceOrderId deve pertencer ao mesmo customerId')
      }
    }

    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      this.buildChargeCreateIdempotencyKey(input)
    const idemScope = 'finance.create_charge'
    const idemPayload = {
      customerId: input.customerId,
      amountCents: input.amountCents,
      dueDate: input.dueDate.toISOString(),
      notes: input.notes ?? null,
      serviceOrderId: input.serviceOrderId ?? null,
    }
    const idem = await this.idempotency.begin({
      orgId: input.orgId,
      scope: idemScope,
      idempotencyKey,
      payload: idemPayload,
    })
    if (idem.mode === 'replay') {
      return idem.response as any
    }
    const idemRecordId = idem.recordId
    try {
      let charge: any = null
      try {
        charge = await this.prisma.charge.create({
          data: {
            orgId: input.orgId,
            customerId: input.customerId,
            idempotencyKey,
            amountCents: input.amountCents,
            dueDate: input.dueDate,
            status: 'PENDING',
            notes: input.notes ?? null,
            serviceOrderId: input.serviceOrderId ?? null,
          },
          include: { customer: true },
        })
      } catch (err: any) {
        if (err?.code !== 'P2002') throw err
        const existing = await this.prisma.charge.findFirst({
          where: { orgId: input.orgId, idempotencyKey },
          include: { customer: true },
        })
        if (!existing) throw err
        const replayPayload = { ...existing, idempotent: true }
        await this.idempotency.complete(idemRecordId, replayPayload)
        return replayPayload
      }

      let whatsappFallbackUsed = false
      if (charge.customer?.phone) {
        await this.sendChargeWhatsApp(charge.id).catch((err) => {
          whatsappFallbackUsed = true
          this.metrics.increment('integrationTemporaryFailures')
          this.logCritical({
            level: 'warn',
            action: 'WHATSAPP_SEND_CHARGE',
            entityId: charge.id,
            message: 'Falha de integração no envio de cobrança. Fluxo seguirá em modo degradado',
            extra: { error: err?.message ?? String(err) },
          })
        })
      }

      await this.safeTimelineLog({
        orgId: input.orgId,
        action: 'CHARGE_CREATED',
        description: `Cobrança criada para ${charge.customer?.name ?? 'cliente'}`,
        customerId: charge.customerId,
        serviceOrderId: charge.serviceOrderId,
        chargeId: charge.id,
        metadata: {
          actorUserId: input.actorUserId ?? null,
          customerId: charge.customerId,
          serviceOrderId: charge.serviceOrderId,
          chargeId: charge.id,
          amountCents: charge.amountCents,
          dueDate: charge.dueDate.toISOString(),
        },
      })

      this.logCritical({
        level: whatsappFallbackUsed ? 'warn' : 'log',
        action: 'CREATE_CHARGE_RESULT',
        entityId: charge.id,
        message: whatsappFallbackUsed
          ? 'Cobrança criada com fallback de WhatsApp (mensagem em fila/pendente)'
          : 'Cobrança criada com sucesso',
        extra: { chargeId: charge.id, orgId: input.orgId },
      })

      void this.analytics.track({
        orgId: input.orgId,
        userId: input.actorUserId ?? undefined,
        event:
          (UsageMetricEvent as any)?.CHARGE_CREATED ??
          (UsageMetricEvent as any)?.LOGIN,
        metadata: {
          source: 'finance_create_charge',
          chargeId: charge.id,
          customerId: charge.customerId,
          serviceOrderId: charge.serviceOrderId,
        },
      })
      const result = {
        ...charge,
        idempotent: false,
        degraded: whatsappFallbackUsed
          ? {
              channel: 'whatsapp',
              reason: 'whatsapp_send_failed',
              fallback: 'message_queued',
            }
          : null,
      }
      await this.idempotency.complete(idemRecordId, result)
      return result
    } catch (error: any) {
      await this.idempotency.fail(idemRecordId, error?.code)
      throw error
    }
  }

  async updateCharge(input: {
    orgId: string
    id: string
    amountCents?: number
    dueDate?: Date
    status?: $Enums.ChargeStatus
    notes?: string | null
    actorUserId?: string | null
  }) {
    const charge = await this.prisma.charge.findFirst({
      where: { id: input.id, orgId: input.orgId },
      select: { id: true, status: true, paidAt: true },
    })

    if (!charge) throw new NotFoundException('Charge não encontrada')

    if (input.status) {
      this.assertChargeStatusTransition(charge.status, input.status)
    }

    return this.prisma.charge.update({
      where: { id: charge.id },
      data: {
        amountCents: input.amountCents,
        dueDate: input.dueDate,
        status: input.status,
        paidAt:
          input.status === 'PAID'
            ? (charge.paidAt ?? new Date())
            : input.status === 'PENDING' || input.status === 'OVERDUE'
              ? null
              : undefined,
        notes: input.notes,
      },
    })
  }

  async deleteCharge(input: {
    orgId: string
    id: string
    actorUserId?: string | null
  }) {
    const charge = await this.prisma.charge.findFirst({
      where: { id: input.id, orgId: input.orgId },
      select: { id: true },
    })

    if (!charge) throw new NotFoundException('Charge não encontrada')

    return this.prisma.charge.delete({ where: { id: charge.id } })
  }

  // =========================
  // PAYMENT
  // =========================
  async payCharge(input: {
    orgId: string
    chargeId: string
    amountCents: number
    method: $Enums.PaymentMethod
    actorUserId?: string | null
    idempotencyKey?: string | null
  }) {
    this.logCritical({
      level: 'log',
      action: 'PAY_CHARGE_START',
      entityId: input.chargeId,
      message: 'Iniciando payCharge',
      extra: { orgId: input.orgId, amountCents: input.amountCents, method: input.method },
    })

    const idempotencyKey =
      input.idempotencyKey?.trim() ||
      ['charge-pay', input.orgId, input.chargeId, input.method, String(input.amountCents)].join(':')
    const idem = await this.idempotency.begin({
      orgId: input.orgId,
      scope: 'finance.pay_charge',
      idempotencyKey,
      payload: {
        chargeId: input.chargeId,
        amountCents: input.amountCents,
        method: input.method,
      },
    })
    if (idem.mode === 'replay') {
      return idem.response as any
    }

    const idemRecordId = idem.recordId

    try {
      const { charge, payment, idempotent } = await this.prisma.$transaction(
        async (tx) => {
      const charge = await tx.charge.findFirst({
        where: { id: input.chargeId, orgId: input.orgId },
      })

      if (!charge) throw new NotFoundException('Charge não encontrada')
      if (charge.status === 'CANCELED') {
        throw new BadRequestException({
          code: 'CHARGE_STATE_INVALID_FOR_PAYMENT',
          message: 'Cobrança cancelada não pode receber novo pagamento.',
          details: { chargeId: input.chargeId, status: charge.status },
        })
      }
      if (input.amountCents <= 0) {
        throw new BadRequestException('amountCents deve ser maior que zero')
      }

      const paidAt = new Date()
      const mutation = await tx.charge.updateMany({
        where: {
          id: charge.id,
          orgId: input.orgId,
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        data: { status: 'PAID', paidAt },
      })

      if (mutation.count !== 1) {
        const alreadyPaid = await tx.charge.findFirst({
          where: { id: charge.id, orgId: input.orgId, status: 'PAID' },
        })

        if (!alreadyPaid) {
          throw new BadRequestException(
            'Charge já foi processada por outra operação',
          )
        }

        const latestPayment = await tx.payment.findFirst({
          where: { orgId: input.orgId, chargeId: charge.id },
          orderBy: { createdAt: 'desc' },
        })

        if (!latestPayment) {
          throw new BadRequestException({
            code: 'CHARGE_ALREADY_PAID',
            message: 'Cobrança já está paga.',
            details: { chargeId: charge.id },
          })
        }

        return { charge: alreadyPaid, payment: latestPayment, idempotent: true }
      }

      const payment = await tx.payment.create({
        data: {
          orgId: input.orgId,
          chargeId: charge.id,
          amountCents: input.amountCents,
          method: input.method,
          paidAt,
        },
      })

          return { charge, payment, idempotent: false }
      },
      )

      if (payment == null) {
        throw new BadRequestException('Pagamento não registrado')
      }

      if (idempotent) {
        const replayed = { ok: true, paymentId: payment.id, idempotent: true }
        await this.idempotency.complete(idemRecordId, replayed)
        return replayed
      }

    let whatsappFallbackUsed = false
    await this.sendPaymentConfirmationWhatsApp(charge.id).catch((err) => {
      whatsappFallbackUsed = true
      this.metrics.increment('integrationTemporaryFailures')
      this.logCritical({
        level: 'warn',
        action: 'WHATSAPP_SEND_PAYMENT_CONFIRMATION',
        entityId: charge.id,
        message: 'Falha de integração no envio do recibo. Fluxo principal seguirá',
        extra: { error: err?.message ?? String(err) },
      })
    })

    await this.safeTimelineLog({
      orgId: input.orgId,
      action: 'CHARGE_PAID',
      description: `Pagamento confirmado para cobrança ${charge.id}`,
      customerId: charge.customerId,
      serviceOrderId: charge.serviceOrderId,
      chargeId: charge.id,
      metadata: {
        actorUserId: input.actorUserId ?? null,
        customerId: charge.customerId,
        serviceOrderId: charge.serviceOrderId,
        chargeId: charge.id,
        paymentId: payment.id,
        amountCents: input.amountCents,
        method: input.method,
      },
    })
    await this.safeTimelineLog({
      orgId: input.orgId,
      action: 'PAYMENT_RECEIVED',
      description: `Pagamento recebido para cobrança ${charge.id}`,
      customerId: charge.customerId,
      serviceOrderId: charge.serviceOrderId,
      chargeId: charge.id,
      metadata: {
        actorUserId: input.actorUserId ?? null,
        customerId: charge.customerId,
        serviceOrderId: charge.serviceOrderId,
        chargeId: charge.id,
        paymentId: payment.id,
        amountCents: input.amountCents,
        method: input.method,
      },
    })

    this.logCritical({
      level: whatsappFallbackUsed ? 'warn' : 'log',
      action: 'PAY_CHARGE_RESULT',
      entityId: charge.id,
      message: whatsappFallbackUsed
        ? 'Pagamento registrado com fallback de notificação WhatsApp'
        : 'Pagamento registrado com sucesso',
      extra: { paymentId: payment.id, orgId: input.orgId },
    })

    void this.analytics.track({
      orgId: input.orgId,
      userId: input.actorUserId ?? undefined,
      event:
        (UsageMetricEvent as any)?.CHARGE_PAID ??
        (UsageMetricEvent as any)?.LOGIN,
      metadata: {
        source: 'finance_pay_charge',
        chargeId: charge.id,
        paymentId: payment.id,
        customerId: charge.customerId,
      },
    })

      const result = {
        ok: true,
        paymentId: payment.id,
        idempotent: false,
        degraded: whatsappFallbackUsed
          ? {
              channel: 'whatsapp',
              reason: 'whatsapp_send_failed',
              fallback: 'message_queued',
            }
          : null,
      }
      await this.idempotency.complete(idemRecordId, result)
      return result
    } catch (error: any) {
      await this.idempotency.fail(idemRecordId, error?.code)
      throw error
    }
  }

  // =========================
  // SERVICE ORDER LINK
  // =========================
  async ensureChargeForServiceOrderDone(input: {
    orgId: string
    serviceOrderId: string
    customerId: string
    amountCents: number
    dueDate?: Date | null
    actorUserId?: string | null
  }) {
    if (!input.serviceOrderId) {
      throw new BadRequestException('serviceOrderId é obrigatório para vincular cobrança')
    }

    if (!input.amountCents || input.amountCents <= 0) {
      throw new BadRequestException('Valor da cobrança inválido para a O.S.')
    }

    const idemKey = [
      'service-order-charge-link',
      input.orgId,
      input.serviceOrderId,
      String(input.amountCents),
      input.dueDate?.toISOString() ?? '-',
    ].join(':')

    const idem = await this.idempotency.begin({
      orgId: input.orgId,
      scope: 'finance.ensure_charge_for_service_order_done',
      idempotencyKey: idemKey,
      payload: {
        serviceOrderId: input.serviceOrderId,
        customerId: input.customerId,
        amountCents: input.amountCents,
        dueDate: input.dueDate?.toISOString() ?? null,
      },
    })
    if (idem.mode === 'replay') {
      return idem.response as any
    }

    try {
      const serviceOrder = await this.assertServiceOrderEligibleForCharge({
      orgId: input.orgId,
      serviceOrderId: input.serviceOrderId,
      customerId: input.customerId,
    })

    const existing = await this.prisma.charge.findFirst({
      where: {
        orgId: input.orgId,
        serviceOrderId: input.serviceOrderId,
      },
    })

      if (existing) {
        const result = { created: false, chargeId: existing.id }
        await this.idempotency.complete(idem.recordId, result)
        return result
      }

      const created = await this.prisma.charge.create({
        data: {
          orgId: input.orgId,
          serviceOrderId: input.serviceOrderId,
          customerId: input.customerId,
          amountCents: input.amountCents,
          status: 'PENDING',
          dueDate: input.dueDate ?? new Date(),
        },
      })

      const result = { created: true, chargeId: created.id }
      await this.idempotency.complete(idem.recordId, result)
      return result
    } catch (error: any) {
      await this.idempotency.fail(idem.recordId, error?.code)
      throw error
    }
  }

  // =========================
  // CRON SUPPORT
  // =========================
  async getAllOrgIds() {
    const orgs = await this.prisma.organization.findMany({
      select: { id: true },
    })
    return orgs.map((o) => o.id)
  }

  async automateOverdueLifecycle(orgId: string) {
    const now = new Date()

    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)

    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const dueToday = await this.prisma.charge.findMany({
      where: {
        orgId,
        status: 'PENDING',
        dueDate: { gte: todayStart, lte: todayEnd },
      },
    })

    for (const charge of dueToday) {
      await this.sendPaymentReminderWhatsApp(charge.id).catch((err) =>
        this.logger.error(`Erro ao enviar lembrete WhatsApp: ${err.message}`),
      )
    }

    const result = await this.prisma.charge.updateMany({
      where: {
        orgId,
        status: 'PENDING',
        dueDate: { lt: todayStart },
      },
      data: { status: 'OVERDUE' },
    })

    const overdue = await this.prisma.charge.findMany({
      where: {
        orgId,
        status: 'OVERDUE',
      },
    })

    for (const charge of overdue) {
      await this.sendPaymentReminderWhatsApp(charge.id).catch((err) =>
        this.logger.error(`Erro overdue WhatsApp: ${err.message}`),
      )
    }

    return { ok: true, updated: result.count }
  }

  // =========================
  // STATS & REPORTS
  // =========================
  async exportChargesCsv(orgId: string) {
    const charges = await this.prisma.charge.findMany({
      where: { orgId },
      include: { customer: true },
      orderBy: { createdAt: 'desc' },
    })

    let csv = 'ID,Cliente,Valor,Vencimento,Status,Criado Em\n'
    for (const c of charges) {
      csv += `${c.id},"${c.customer?.name ?? ''}",${c.amountCents / 100},${c.dueDate.toISOString()},${c.status},${c.createdAt.toISOString()}\n`
    }
    return csv
  }

  async getChargeStats(orgId: string) {
    const [pending, overdue, paid] = await Promise.all([
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
      this.prisma.charge.aggregate({
        where: { orgId, status: 'PAID' },
        _count: { _all: true },
        _sum: { amountCents: true },
      }),
    ])

    return {
      pending: {
        count: pending._count._all ?? 0,
        amountCents: pending._sum.amountCents ?? 0,
      },
      overdue: {
        count: overdue._count._all ?? 0,
        amountCents: overdue._sum.amountCents ?? 0,
      },
      paid: {
        count: paid._count._all ?? 0,
        amountCents: paid._sum.amountCents ?? 0,
      },
    }
  }

  async getRevenueByMonth(orgId: string) {
    const payments = await this.prisma.payment.findMany({
      where: { orgId },
      select: { amountCents: true, paidAt: true },
    })

    const months: Record<string, number> = {}
    for (const p of payments) {
      const month = p.paidAt.toISOString().slice(0, 7)
      months[month] = (months[month] || 0) + p.amountCents
    }

    return Object.entries(months)
      .map(([month, amountCents]) => ({ month, amountCents }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }

  async createAutomationCharge(data: Record<string, string | number | boolean | null>) {
    return { ok: true }
  }

  async sendPaymentReminder(data: Record<string, string | number | boolean | null>) {
    return { ok: true }
  }

  // =========================
  // WHATSAPP INTEGRATION
  // =========================
  private formatCurrency(cents: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100)
  }

  private formatDate(date: Date) {
    return new Intl.DateTimeFormat('pt-BR').format(date)
  }

  async sendChargeWhatsApp(chargeId: string) {
    const charge = await this.prisma.charge.findUnique({
      where: { id: chargeId },
      include: { customer: true },
    })

    if (!charge || !charge.customer?.phone) return

    const amount = this.formatCurrency(charge.amountCents)
    const dueDate = this.formatDate(charge.dueDate)
    const text = `Olá, ${charge.customer.name}! Segue a sua cobrança no valor de ${amount}, com vencimento em ${dueDate}.`

    await this.whatsapp.enqueueMessage({
      orgId: charge.orgId,
      customerId: charge.customerId,
      toPhone: charge.customer.phone,
      entityType: WhatsAppEntityType.CHARGE,
      entityId: charge.id,
      messageType: WhatsAppMessageType.PAYMENT_LINK,
      messageKey: buildDeterministicMessageKey({
        entityType: WhatsAppEntityType.CHARGE,
        entityId: charge.id,
        messageType: WhatsAppMessageType.PAYMENT_LINK,
      }),
      renderedText: text,
    })
  }

  async sendPaymentConfirmationWhatsApp(chargeId: string) {
    const charge = await this.prisma.charge.findUnique({
      where: { id: chargeId },
      include: { customer: true },
    })

    if (!charge || !charge.customer?.phone) return

    const amount = this.formatCurrency(charge.amountCents)
    const text = `Olá, ${charge.customer.name}! Recebemos o seu pagamento no valor de ${amount}. Obrigado!`

    await this.whatsapp.enqueueMessage({
      orgId: charge.orgId,
      customerId: charge.customerId,
      toPhone: charge.customer.phone,
      entityType: WhatsAppEntityType.CHARGE,
      entityId: charge.id,
      messageType: WhatsAppMessageType.RECEIPT,
      messageKey: buildDeterministicMessageKey({
        entityType: WhatsAppEntityType.CHARGE,
        entityId: charge.id,
        messageType: WhatsAppMessageType.RECEIPT,
      }),
      renderedText: text,
    })
  }

  async sendPaymentReminderWhatsApp(chargeId: string) {
    const charge = await this.prisma.charge.findUnique({
      where: { id: chargeId },
      include: { customer: true },
    })

    if (!charge || !charge.customer?.phone) return

    const amount = this.formatCurrency(charge.amountCents)
    const dueDate = this.formatDate(charge.dueDate)
    const text = `Olá, ${charge.customer.name}! Lembramos que sua cobrança de ${amount} vence em ${dueDate}.`

    await this.whatsapp.enqueueMessage({
      orgId: charge.orgId,
      customerId: charge.customerId,
      toPhone: charge.customer.phone,
      entityType: WhatsAppEntityType.CHARGE,
      entityId: charge.id,
      messageType: WhatsAppMessageType.PAYMENT_REMINDER,
      messageKey: buildDeterministicMessageKey({
        entityType: WhatsAppEntityType.CHARGE,
        entityId: charge.id,
        messageType: WhatsAppMessageType.PAYMENT_REMINDER,
      }),
      renderedText: text,
    })
  }

  async remindChargeInOrg(orgId: string, chargeId: string) {
    const charge = await this.prisma.charge.findFirst({
      where: { id: chargeId, orgId },
      select: { id: true },
    })
    if (!charge) throw new NotFoundException('Charge não encontrada')
    await this.sendPaymentReminderWhatsApp(charge.id)
  }
}
