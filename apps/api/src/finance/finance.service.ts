import {
  Injectable,
  NotFoundException,
} from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { $Enums } from '@prisma/client'

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
    const where: any = { orgId }

    if (query?.status) {
      where.status = query.status
    }

    const items = await this.prisma.charge.findMany({
      where,
      include: {
        customer: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return { items }
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
  }) {
    return this.prisma.charge.create({
      data: {
        orgId: input.orgId,
        customerId: input.customerId,
        amountCents: input.amountCents,
        dueDate: input.dueDate,
        status: 'PENDING',
        notes: input.notes ?? null,
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
        status: input.status,
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
  // STUBS
  // =========================
  async exportChargesCsv(orgId: string) {
    return 'csv'
  }

  async getChargeStats(orgId: string) {
    return {}
  }

  async getRevenueByMonth(orgId: string) {
    return []
  }

  async createAutomationCharge(data: any) {
    return {}
  }

  async sendPaymentReminder(data: any) {
    return {}
  }
}
