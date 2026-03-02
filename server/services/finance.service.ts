import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { AuditService } from '../audit/audit.service'
import { AUDIT_ACTIONS } from '../audit/audit.actions'
import { $Enums } from '@prisma/client'
import { ChargesQueryDto } from './dto/charges-query.dto'

function isUuidLike(s: string): boolean {
  // UUID v4/v1 “parecido” (bom o suficiente pra decidir equals vs contains)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  )
}

@Injectable()
export class FinanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly timeline: TimelineService,
    private readonly audit: AuditService,
  ) {}

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

    let customerId = input.customerId
    if (!customerId) {
      const so = await this.prisma.serviceOrder.findFirst({
        where: { id: input.serviceOrderId, orgId: input.orgId },
        select: { customerId: true },
      })

      if (!so) throw new NotFoundException('ServiceOrder não encontrada')
      if (!so.customerId) {
        throw new BadRequestException('ServiceOrder sem customerId para cobrança')
      }

      customerId = so.customerId
    }

    const existing = await this.prisma.charge.findFirst({
      where: {
        orgId: input.orgId,
        serviceOrderId: input.serviceOrderId,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, amountCents: true, dueDate: true },
    })

    if (existing) {
      const shouldUpdate =
        existing.amountCents !== amountCents ||
        (dueDate && existing.dueDate.getTime() !== dueDate.getTime())

      if (shouldUpdate) {
        await this.prisma.charge.update({
          where: { id: existing.id },
          data: {
            amountCents,
            dueDate: dueDate ?? existing.dueDate,
          },
        })
      }

      return { created: false, chargeId: existing.id }
    }

    const finalDueDate =
      dueDate ?? new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)

    const created = await this.prisma.charge.create({
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

    await this.timeline.log({
      orgId: input.orgId,
      personId: input.actorPersonId ?? null,
      action: 'CHARGE_CREATED',
      description: 'Cobrança criada automaticamente (O.S. concluída)',
      metadata: {
        chargeId: created.id,
        serviceOrderId: input.serviceOrderId,
        customerId,
        amountCents,
        dueDate: finalDueDate.toISOString(),
        actorUserId: input.actorUserId ?? null,
        actorPersonId: input.actorPersonId ?? null,
      },
    })

    await this.audit.log({
      orgId: input.orgId,
      action: AUDIT_ACTIONS.CHARGE_CREATED,
      actorUserId: input.actorUserId ?? null,
      actorPersonId: input.actorPersonId ?? null,
      personId: input.actorPersonId ?? null,
      entityType: 'CHARGE',
      entityId: created.id,
      context: 'Cobrança gerada a partir de ServiceOrder DONE',
    })

    return { created: true, chargeId: created.id }
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

      if (input.amountCents !== charge.amountCents) {
        throw new BadRequestException('Valor do pagamento diferente da cobrança')
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

      await tx.charge.update({
        where: { id: charge.id },
        data: {
          status: 'PAID',
          paidAt: now,
        },
      })

      // Timeline (ATÔMICO)
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
          },
        },
      })

      // Audit: CHARGE_PAID (ATÔMICO)
      await tx.auditEvent.create({
        data: {
          orgId: input.orgId,
          action: AUDIT_ACTIONS.CHARGE_PAID,
          actorUserId: input.actorUserId ?? null,
          actorPersonId: input.actorPersonId ?? null,
          personId: input.actorPersonId ?? null, // legado
          entityType: 'CHARGE',
          entityId: charge.id,
          context: 'Cobrança marcada como paga',
          metadata: {
            paymentId: payment.id,
            method: input.method,
            amountCents: input.amountCents,
          },
        },
      })

      // Audit: PAYMENT_CREATED (ATÔMICO)
      await tx.auditEvent.create({
        data: {
          orgId: input.orgId,
          action: AUDIT_ACTIONS.PAYMENT_CREATED,
          actorUserId: input.actorUserId ?? null,
          actorPersonId: input.actorPersonId ?? null,
          personId: input.actorPersonId ?? null, // legado
          entityType: 'PAYMENT',
          entityId: payment.id,
          context: 'Pagamento criado',
          metadata: {
            chargeId: charge.id,
            method: input.method,
            amountCents: input.amountCents,
          },
        },
      })

      return { paymentId: payment.id }
    })
  }

  async listCharges(orgId: string, query?: ChargesQueryDto) {
    const status = query?.status
    const rawLimit = query?.limit
    const q = (query?.q ?? '').trim()
    const cursor = (query?.cursor ?? '').trim() || undefined
    const orderBy = query?.orderBy ?? 'createdAt'
    const direction = query?.direction ?? 'desc'

    // limit: default 50, range 0..100
    let limit = 50
    if (rawLimit !== undefined) {
      if (!Number.isFinite(rawLimit)) {
        throw new BadRequestException('limit inválido')
      }
      if (rawLimit < 0) throw new BadRequestException('limit não pode ser negativo')
      if (rawLimit > 100) throw new BadRequestException('limit máximo é 100')
      limit = rawLimit
    }

    if (limit === 0) {
      return {
        items: [],
        meta: {
          limit,
          orderBy,
          direction,
          hasMore: false,
          nextCursor: null,
        },
      }
    }

    // ✅ cursor inválido = 400 (evita UI “silenciosa”)
    if (cursor) {
      const exists = await this.prisma.charge.findFirst({
        where: { id: cursor, orgId },
        select: { id: true },
      })
      if (!exists) throw new BadRequestException('cursor inválido')
    }

    // where base
    const where: any = {
      orgId,
      ...(status ? { status } : {}),
    }

    // q inteligente: UUID -> equals, humano -> contains
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

    // orderBy + tie-breaker por id (pra paginação não “pular/duplicar”)
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

    // Paginação por cursor (cursor = id da última charge)
    // Técnica: take = limit + 1 para saber hasMore
    const take = limit + 1

    const rows = await this.prisma.charge.findMany({
      where,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: order,
      take,
      select: {
        id: true,
        serviceOrderId: true,
        customerId: true,
        amountCents: true,
        status: true,
        dueDate: true,
        createdAt: true,
        customer: {
          select: { id: true, name: true, phone: true },
        },
        serviceOrder: {
          select: { id: true, title: true, status: true },
        },
      },
    })

    const hasMore = rows.length > limit
    const items = hasMore ? rows.slice(0, limit) : rows

    // ✅ CORREÇÃO: só retorna nextCursor se realmente houver próxima página
    const nextCursor =
      hasMore && items.length ? items[items.length - 1].id : null

    return {
      items,
      meta: {
        limit,
        orderBy,
        direction,
        hasMore,
        nextCursor,
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
}
