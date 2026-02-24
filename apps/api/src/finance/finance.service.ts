import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { TimelineService } from '../timeline/timeline.service'
import { AuditService } from '../audit/audit.service'
import { $Enums } from '@prisma/client'
import { ChargesQueryDto } from './dto/charges-query.dto'

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
      },
    })

    await this.audit.log({
      orgId: input.orgId,
      action: 'CHARGE_CREATED',
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
    const charge = await this.prisma.charge.findFirst({
      where: { id: input.chargeId, orgId: input.orgId },
      select: { id: true, amountCents: true, status: true },
    })

    if (!charge) throw new NotFoundException('Cobrança não encontrada')

    if (charge.status === 'PAID') return { alreadyPaid: true }

    if (input.amountCents !== charge.amountCents) {
      throw new BadRequestException('Valor do pagamento diferente da cobrança')
    }

    const payment = await this.prisma.payment.create({
      data: {
        orgId: input.orgId,
        chargeId: charge.id,
        amountCents: input.amountCents,
        method: input.method,
        paidAt: new Date(),
      },
      select: { id: true },
    })

    await this.prisma.charge.update({
      where: { id: charge.id },
      data: {
        status: 'PAID',
        paidAt: new Date(),
      },
    })

    await this.timeline.log({
      orgId: input.orgId,
      personId: input.actorPersonId,
      action: 'CHARGE_PAID',
      description: `Cobrança paga (${input.method})`,
      metadata: {
        chargeId: charge.id,
        amountCents: input.amountCents,
        method: input.method,
      },
    })

    await this.audit.log({
      orgId: input.orgId,
      action: 'CHARGE_PAID',
      actorUserId: input.actorUserId,
      actorPersonId: input.actorPersonId,
      personId: input.actorPersonId,
      entityType: 'CHARGE',
      entityId: charge.id,
      context: 'Cobrança marcada como paga',
    })

    return { paymentId: payment.id }
  }

  async listCharges(orgId: string, query?: ChargesQueryDto) {
    const status = query?.status
    const rawLimit = query?.limit
    const q = (query?.q ?? '').trim()

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

    if (limit === 0) return []

    const where: any = {
      orgId,
      ...(status ? { status } : {}),
      ...(q
        ? {
            OR: [
              { customer: { name: { contains: q, mode: 'insensitive' } } },
              { customer: { phone: { contains: q } } },
              { serviceOrder: { title: { contains: q, mode: 'insensitive' } } },
              { id: { contains: q } },
              { customerId: { contains: q } },
              { serviceOrderId: { contains: q } },
            ],
          }
        : {}),
    }

    return this.prisma.charge.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
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
