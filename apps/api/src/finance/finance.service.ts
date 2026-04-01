import {
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { $Enums, Prisma } from '@prisma/client'

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

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
  async listCharges(orgId: string, query?: any) {
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
  }) {
    return this.prisma.charge.create({
      data: {
        orgId: input.orgId,
        customerId: input.customerId,
        amountCents: input.amountCents,
        dueDate: input.dueDate,
        status: 'PENDING',
        notes: input.notes ?? null,
        serviceOrderId: input.serviceOrderId ?? null,
      },
    })
  }

  async updateCharge(input: {
    orgId: string
    id: string
    amountCents?: number
    dueDate?: Date
    status?: string
    actorUserId?: string | null
  }) {
    return this.prisma.charge.update({
      where: { id: input.id },
      data: {
        amountCents: input.amountCents,
        dueDate: input.dueDate,
        status: input.status as any,
      },
    })
  }

  async deleteCharge(input: {
    orgId: string
    id: string
    actorUserId?: string | null
  }) {
    return this.prisma.charge.delete({
      where: { id: input.id },
    })
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
  }) {
    const charge = await this.prisma.charge.findFirst({
      where: { id: input.chargeId, orgId: input.orgId },
    })

    if (!charge) throw new NotFoundException('Charge não encontrada')

    await this.prisma.payment.create({
      data: {
        orgId: input.orgId,
        chargeId: charge.id,
        amountCents: input.amountCents,
        method: input.method,
        paidAt: new Date(),
      },
    })

    await this.prisma.charge.update({
      where: { id: charge.id },
      data: { status: 'PAID', paidAt: new Date() },
    })

    return { ok: true }
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
    const existing = await this.prisma.charge.findFirst({
      where: {
        orgId: input.orgId,
        serviceOrderId: input.serviceOrderId,
      },
    })

    if (existing) return { created: false }

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

    return { created: true, chargeId: created.id }
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

    const result = await this.prisma.charge.updateMany({
      where: {
        orgId,
        status: 'PENDING',
        dueDate: { lt: now },
      },
      data: { status: 'OVERDUE' },
    })

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
      const month = p.paidAt.toISOString().slice(0, 7) // YYYY-MM
      months[month] = (months[month] || 0) + p.amountCents
    }

    return Object.entries(months)
      .map(([month, amountCents]) => ({ month, amountCents }))
      .sort((a, b) => a.month.localeCompare(b.month))
  }

  async createAutomationCharge(data: any) {
    // Placeholder for future automation logic
    return { ok: true }
  }

  async sendPaymentReminder(data: any) {
    // Placeholder for future notification logic
    return { ok: true }
  }
}
