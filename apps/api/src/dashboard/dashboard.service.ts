import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MemoryCacheService } from '../common/cache/memory-cache.service'
import { GovernanceReadService } from '../governance/governance-read.service'

const CACHE_TTL_METRICS = 300_000 // 5 minutos
const CACHE_TTL_CHARTS = 900_000 // 15 minutos

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: MemoryCacheService,
    private readonly governanceRead: GovernanceReadService,
  ) {}

  async getMetrics(orgId: string) {
    return this.cache.getOrSet(
      `dashboard:metrics:${orgId}`,
      () => this.fetchMetrics(orgId),
      CACHE_TTL_METRICS,
    )
  }

  private async fetchMetrics(orgId: string) {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    // Executa as consultas em lotes menores para não sobrecarregar a conexão com o banco
    const batch1 = await Promise.all([
      this.prisma.customer.count({ where: { orgId, active: true } }),
      this.prisma.customer.count({ where: { orgId } }),
      this.prisma.serviceOrder.count({ where: { orgId } }),
      this.prisma.serviceOrder.count({
        where: { orgId, status: { in: ['OPEN', 'ASSIGNED'] } },
      }),
      this.prisma.serviceOrder.count({
        where: {
          orgId,
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
          dueDate: { lt: now },
        },
      }),
      this.prisma.payment.aggregate({
        where: { orgId, createdAt: { gte: startOfWeek } },
        _sum: { amountCents: true },
      }),
    ])

    const batch2 = await Promise.all([
      this.prisma.charge.aggregate({
        where: { orgId, status: { in: ['PENDING', 'OVERDUE'] } },
        _sum: { amountCents: true },
      }),
      this.prisma.serviceOrder.count({
        where: { orgId, status: 'IN_PROGRESS' },
      }),
      this.prisma.serviceOrder.count({
        where: { orgId, status: 'DONE' },
      }),
      this.prisma.correctiveAction.count({
        where: { person: { orgId }, status: 'OPEN' },
      }),
      this.prisma.charge.count({ where: { orgId } }),
    ])

    const batch3 = await Promise.all([
      this.prisma.charge.aggregate({
        where: { orgId },
        _sum: { amountCents: true },
      }),
      this.prisma.charge.aggregate({
        where: { orgId, status: 'PAID' },
        _sum: { amountCents: true },
      }),
      this.governanceRead.getAutoScore(orgId),
    ])

    const [totalCustomers, createdCustomers, totalServiceOrders, openServiceOrders, overdueServiceOrders, weeklyRevenueAgg] = batch1
    const [pendingPaymentsAgg, inProgressOrders, completedOrders, riskTickets, chargesGenerated] = batch2
    const [totalRevenue, paidRevenue, autoScore] = batch3

    // Reutiliza valores já calculados para evitar redundância
    const delayedOrders = overdueServiceOrders
    const pendingRevenue = pendingPaymentsAgg

    return {
      totalCustomers,
      createdCustomers,
      totalServiceOrders,
      openServiceOrders,
      overdueServiceOrders,
      weeklyRevenueInCents: weeklyRevenueAgg._sum.amountCents ?? 0,
      pendingPaymentsInCents: pendingPaymentsAgg._sum.amountCents ?? 0,
      inProgressOrders,
      completedOrders,
      completedServices: completedOrders,
      chargesGenerated,
      delayedOrders,
      riskTickets,
      totalRevenueInCents: totalRevenue._sum.amountCents ?? 0,
      paidRevenueInCents: paidRevenue._sum.amountCents ?? 0,
      pendingRevenueInCents: pendingRevenue._sum.amountCents ?? 0,
      governance: autoScore,
    }
  }

  async getAlerts(orgId: string) {
    return this.cache.getOrSet(
      `dashboard:alerts:${orgId}`,
      () => this.fetchAlerts(orgId),
      CACHE_TTL_METRICS,
    )
  }

  private async fetchAlerts(orgId: string) {
    const now = new Date()
    const todayStart = new Date(now)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(now)
    todayEnd.setHours(23, 59, 59, 999)

    const [
      overdueOrders,
      overdueCharges,
      todayAppointments,
      customersWithPending,
      doneOrdersWithoutCharge,
    ] = await Promise.all([
      this.prisma.serviceOrder.findMany({
        where: {
          orgId,
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
          dueDate: { lt: now },
        },
        select: {
          id: true,
          title: true,
          dueDate: true,
          status: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      this.prisma.charge.findMany({
        where: {
          orgId,
          status: { in: ['PENDING', 'OVERDUE'] },
          dueDate: { lt: now },
        },
        select: {
          id: true,
          amountCents: true,
          dueDate: true,
          status: true,
          customer: { select: { id: true, name: true } },
          serviceOrderId: true,
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),
      this.prisma.appointment.findMany({
        where: {
          orgId,
          startsAt: { gte: todayStart, lte: todayEnd },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          notes: true,
          status: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: { startsAt: 'asc' },
        take: 10,
      }),
      this.prisma.customer.findMany({
        where: {
          orgId,
          active: true,
          charges: {
            some: {
              status: { in: ['PENDING', 'OVERDUE'] },
            },
          },
        },
        select: {
          id: true,
          name: true,
          phone: true,
          charges: {
            where: { status: { in: ['PENDING', 'OVERDUE'] } },
            select: { amountCents: true, dueDate: true, status: true },
          },
        },
        take: 10,
      }),
      this.prisma.serviceOrder.findMany({
        where: {
          orgId,
          status: 'DONE',
          charges: {
            none: {},
          },
        },
        select: {
          id: true,
          title: true,
          amountCents: true,
          scheduledFor: true,
          finishedAt: true,
          createdAt: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: [{ finishedAt: 'desc' }, { createdAt: 'desc' }],
        take: 10,
      }),
    ])

    return {
      overdueOrders: {
        count: overdueOrders.length,
        items: overdueOrders,
      },
      overdueCharges: {
        count: overdueCharges.length,
        totalAmountCents: overdueCharges.reduce(
          (sum, c) => sum + (c.amountCents ?? 0),
          0,
        ),
        items: overdueCharges,
      },
      todayServices: {
        count: todayAppointments.length,
        items: todayAppointments.map((appointment) => ({
          id: appointment.id,
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
          status: appointment.status,
          notes: appointment.notes,
          customer: appointment.customer,
          label:
            appointment.notes?.trim() ||
            `Agendamento com ${appointment.customer.name}`,
        })),
      },
      customersWithPending: {
        count: customersWithPending.length,
        items: customersWithPending.map((customer) => ({
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          pendingCharges: customer.charges.length,
          totalPendingCents: customer.charges.reduce(
            (sum, charge) => sum + (charge.amountCents ?? 0),
            0,
          ),
        })),
      },
      doneOrdersWithoutCharge: {
        count: doneOrdersWithoutCharge.length,
        totalAmountCents: doneOrdersWithoutCharge.reduce(
          (sum, order) => sum + (order.amountCents ?? 0),
          0,
        ),
        items: doneOrdersWithoutCharge.map((order) => {
          const referenceDate = order.finishedAt ?? order.createdAt
          const diffMs = now.getTime() - referenceDate.getTime()
          const daysWithoutCharge = Math.max(
            0,
            Math.floor(diffMs / (1000 * 60 * 60 * 24)),
          )

          return {
            id: order.id,
            title: order.title,
            amountCents: order.amountCents ?? 0,
            scheduledFor: order.scheduledFor,
            finishedAt: order.finishedAt,
            createdAt: order.createdAt,
            daysWithoutCharge,
            customer: order.customer,
          }
        }),
      },
    }
  }

  async getRevenueData(orgId: string) {
    return this.cache.getOrSet(
      `dashboard:revenue:${orgId}`,
      () => this.fetchRevenueData(orgId),
      CACHE_TTL_CHARTS,
    )
  }

  private async fetchRevenueData(orgId: string) {
    const now = new Date()
    const months: Array<{ month: string; date: Date; revenue: number }> = []

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const month = date.toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      })
      months.push({ month, date, revenue: 0 })
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        orgId,
        createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) },
      },
      select: { amountCents: true, createdAt: true },
    })

    for (const payment of payments) {
      const paymentMonth = new Date(
        payment.createdAt.getFullYear(),
        payment.createdAt.getMonth(),
        1,
      )

      const monthIndex = months.findIndex(
        entry =>
          entry.date.getFullYear() === paymentMonth.getFullYear() &&
          entry.date.getMonth() === paymentMonth.getMonth(),
      )

      if (monthIndex !== -1) {
        months[monthIndex].revenue += payment.amountCents
      }
    }

    return months.map(entry => ({
      month: entry.month,
      revenue: entry.revenue / 100,
    }))
  }

  async getCustomerGrowth(orgId: string) {
    return this.cache.getOrSet(
      `dashboard:growth:${orgId}`,
      () => this.fetchCustomerGrowth(orgId),
      CACHE_TTL_CHARTS,
    )
  }

  private async fetchCustomerGrowth(orgId: string) {
    const now = new Date()
    const months: Array<{
      month: string
      date: Date
      newCustomers: number
      totalCustomers: number
    }> = []

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const month = date.toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      })
      months.push({ month, date, newCustomers: 0, totalCustomers: 0 })
    }

    const customers = await this.prisma.customer.findMany({
      where: {
        orgId,
        createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    for (const customer of customers) {
      const customerMonth = new Date(
        customer.createdAt.getFullYear(),
        customer.createdAt.getMonth(),
        1,
      )

      const monthIndex = months.findIndex(
        entry =>
          entry.date.getFullYear() === customerMonth.getFullYear() &&
          entry.date.getMonth() === customerMonth.getMonth(),
      )

      if (monthIndex !== -1) {
        months[monthIndex].newCustomers += 1
      }
    }

    let cumulative = 0

    for (const month of months) {
      cumulative += month.newCustomers
      month.totalCustomers = cumulative
    }

    return months.map(month => ({
      month: month.month,
      newCustomers: month.newCustomers,
      totalCustomers: month.totalCustomers,
    }))
  }

  async getServiceOrdersStatus(orgId: string) {
    return this.cache.getOrSet(
      `dashboard:so-status:${orgId}`,
      () => this.fetchServiceOrdersStatus(orgId),
      CACHE_TTL_METRICS,
    )
  }

  private async fetchServiceOrdersStatus(orgId: string) {
    const [open, assigned, inProgress, completed, cancelled] = await Promise.all([
      this.prisma.serviceOrder.count({ where: { orgId, status: 'OPEN' } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: 'ASSIGNED' } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: 'IN_PROGRESS' } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: 'DONE' } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: 'CANCELED' } }),
    ])

    return {
      open,
      assigned,
      inProgress,
      completed,
      cancelled,
    }
  }

  async getChargesStatus(orgId: string) {
    return this.cache.getOrSet(
      `dashboard:charges-status:${orgId}`,
      () => this.fetchChargesStatus(orgId),
      CACHE_TTL_METRICS,
    )
  }

  private async fetchChargesStatus(orgId: string) {
    const [pending, paid, overdue, cancelled] = await Promise.all([
      this.prisma.charge.count({ where: { orgId, status: 'PENDING' } }),
      this.prisma.charge.count({ where: { orgId, status: 'PAID' } }),
      this.prisma.charge.count({ where: { orgId, status: 'OVERDUE' } }),
      this.prisma.charge.count({ where: { orgId, status: 'CANCELED' } }),
    ])

    return {
      pending,
      paid,
      overdue,
      cancelled,
    }
  }

  invalidateCache(orgId: string): void {
    this.cache.deleteByPrefix(`dashboard:metrics:${orgId}`)
    this.cache.deleteByPrefix(`dashboard:alerts:${orgId}`)
    this.cache.deleteByPrefix(`dashboard:revenue:${orgId}`)
    this.cache.deleteByPrefix(`dashboard:growth:${orgId}`)
    this.cache.deleteByPrefix(`dashboard:so-status:${orgId}`)
    this.cache.deleteByPrefix(`dashboard:charges-status:${orgId}`)
  }
}
