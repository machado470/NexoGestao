import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { MemoryCacheService } from '../common/cache/memory-cache.service'

const CACHE_TTL_METRICS = 60_000 // 1 minuto
const CACHE_TTL_CHARTS = 300_000 // 5 minutos

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: MemoryCacheService,
  ) {}

  /**
   * Retorna métricas operacionais gerais do sistema (com cache de 1 min)
   */
  async getMetrics(orgId: string) {
    return this.cache.getOrSet(
      `dashboard:metrics:${orgId}`,
      () => this._fetchMetrics(orgId),
      CACHE_TTL_METRICS,
    )
  }

  private async _fetchMetrics(orgId: string) {
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay())
    startOfWeek.setHours(0, 0, 0, 0)

    const [
      totalCustomers,
      totalServiceOrders,
      openServiceOrders,
      overdueServiceOrders,
      weeklyRevenueAgg,
      pendingPaymentsAgg,
      inProgressOrders,
      completedOrders,
      delayedOrders,
      riskTickets,
      totalRevenue,
      paidRevenue,
      pendingRevenue,
    ] = await Promise.all([
      this.prisma.customer.count({ where: { orgId, active: true } }),
      this.prisma.serviceOrder.count({ where: { orgId } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: { in: ['OPEN', 'ASSIGNED'] } } }),
      this.prisma.serviceOrder.count({
        where: { orgId, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] }, dueDate: { lt: now } },
      }),
      this.prisma.payment.aggregate({ where: { orgId, createdAt: { gte: startOfWeek } }, _sum: { amountCents: true } }),
      this.prisma.charge.aggregate({ where: { orgId, status: { in: ['PENDING', 'OVERDUE'] } }, _sum: { amountCents: true } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: 'IN_PROGRESS' } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: 'DONE' } }),
      this.prisma.serviceOrder.count({
        where: { orgId, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] }, dueDate: { lt: now } },
      }),
      this.prisma.correctiveAction.count({ where: { person: { orgId }, status: 'OPEN' } }),
      this.prisma.charge.aggregate({ where: { orgId }, _sum: { amountCents: true } }),
      this.prisma.charge.aggregate({ where: { orgId, status: 'PAID' }, _sum: { amountCents: true } }),
      this.prisma.charge.aggregate({ where: { orgId, status: { in: ['PENDING', 'OVERDUE'] } }, _sum: { amountCents: true } }),
    ])

    return {
      totalCustomers,
      openServiceOrders,
      overdueServiceOrders,
      weeklyRevenueInCents: weeklyRevenueAgg._sum.amountCents ?? 0,
      pendingPaymentsInCents: pendingPaymentsAgg._sum.amountCents ?? 0,
      totalServiceOrders,
      inProgressOrders,
      completedOrders,
      delayedOrders,
      riskTickets,
      totalRevenueInCents: totalRevenue._sum.amountCents ?? 0,
      paidRevenueInCents: paidRevenue._sum.amountCents ?? 0,
      pendingRevenueInCents: pendingRevenue._sum.amountCents ?? 0,
    }
  }

  /**
   * Alertas operacionais: ordens atrasadas, cobranças vencidas, serviços do dia, clientes com pagamento pendente
   */
  async getAlerts(orgId: string) {
    return this.cache.getOrSet(
      `dashboard:alerts:${orgId}`,
      () => this._fetchAlerts(orgId),
      CACHE_TTL_METRICS,
    )
  }

  private async _fetchAlerts(orgId: string) {
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
    ] = await Promise.all([
      // Ordens atrasadas
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

      // Cobranças vencidas
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
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      }),

      // Serviços do dia (agendamentos de hoje)
      this.prisma.appointment.findMany({
        where: {
          orgId,
          startsAt: { gte: todayStart, lte: todayEnd },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        select: {
          id: true,
          title: true,
          startsAt: true,
          status: true,
          customer: { select: { id: true, name: true } },
        },
        orderBy: { startsAt: 'asc' },
        take: 10,
      }),

      // Clientes com pagamento pendente
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
    ])

    return {
      overdueOrders: {
        count: overdueOrders.length,
        items: overdueOrders,
      },
      overdueCharges: {
        count: overdueCharges.length,
        totalAmountCents: overdueCharges.reduce((sum, c) => sum + c.amountCents, 0),
        items: overdueCharges,
      },
      todayServices: {
        count: todayAppointments.length,
        items: todayAppointments,
      },
      customersWithPending: {
        count: customersWithPending.length,
        items: customersWithPending.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          pendingCharges: c.charges.length,
          totalPendingCents: c.charges.reduce((sum, ch) => sum + ch.amountCents, 0),
        })),
      },
    }
  }

  /**
   * Retorna dados de faturamento por período (últimos 12 meses) - cache 5 min
   */
  async getRevenueData(orgId: string) {
    return this.cache.getOrSet(
      `dashboard:revenue:${orgId}`,
      () => this._fetchRevenueData(orgId),
      CACHE_TTL_CHARTS,
    )
  }

  private async _fetchRevenueData(orgId: string) {
    const now = new Date()
    const months: Array<{ month: string; date: Date; revenue: number }> = []

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      months.push({ month: monthName, date, revenue: 0 })
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        orgId,
        createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) },
      },
      select: { amountCents: true, createdAt: true },
    })

    payments.forEach((payment) => {
      const paymentMonth = new Date(payment.createdAt.getFullYear(), payment.createdAt.getMonth(), 1)
      const monthIndex = months.findIndex(
        (m) => m.date.getFullYear() === paymentMonth.getFullYear() && m.date.getMonth() === paymentMonth.getMonth(),
      )
      if (monthIndex !== -1) months[monthIndex].revenue += payment.amountCents
    })

    return months.map((m) => ({ month: m.month, revenue: m.revenue / 100 }))
  }

  /**
   * Retorna crescimento de clientes por mês (últimos 12 meses) - cache 5 min
   */
  async getCustomerGrowth(orgId: string) {
    return this.cache.getOrSet(
      `dashboard:growth:${orgId}`,
      () => this._fetchCustomerGrowth(orgId),
      CACHE_TTL_CHARTS,
    )
  }

  private async _fetchCustomerGrowth(orgId: string) {
    const now = new Date()
    const months: Array<{ month: string; date: Date; newCustomers: number; totalCustomers: number }> = []

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = date.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
      months.push({ month: monthName, date, newCustomers: 0, totalCustomers: 0 })
    }

    const customers = await this.prisma.customer.findMany({
      where: {
        orgId,
        createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 11, 1) },
      },
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    customers.forEach((customer) => {
      const customerMonth = new Date(customer.createdAt.getFullYear(), customer.createdAt.getMonth(), 1)
      const monthIndex = months.findIndex(
        (m) => m.date.getFullYear() === customerMonth.getFullYear() && m.date.getMonth() === customerMonth.getMonth(),
      )
      if (monthIndex !== -1) months[monthIndex].newCustomers += 1
    })

    let cumulative = 0
    months.forEach((m) => { cumulative += m.newCustomers; m.totalCustomers = cumulative })

    return months.map((m) => ({ month: m.month, newCustomers: m.newCustomers, totalCustomers: m.totalCustomers }))
  }

  async getServiceOrdersStatus(orgId: string) {
    return this.cache.getOrSet(
      `dashboard:so-status:${orgId}`,
      () => this._fetchServiceOrdersStatus(orgId),
      CACHE_TTL_METRICS,
    )
  }

  private async _fetchServiceOrdersStatus(orgId: string) {
    const [openCount, assignedCount, inProgressCount, doneCount, canceledCount] = await Promise.all([
      this.prisma.serviceOrder.count({ where: { orgId, status: 'OPEN' } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: 'ASSIGNED' } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: 'IN_PROGRESS' } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: 'DONE' } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: 'CANCELED' } }),
    ])
    return { open: openCount, assigned: assignedCount, inProgress: inProgressCount, completed: doneCount, cancelled: canceledCount }
  }

  async getChargesStatus(orgId: string) {
    return this.cache.getOrSet(
      `dashboard:charges-status:${orgId}`,
      () => this._fetchChargesStatus(orgId),
      CACHE_TTL_METRICS,
    )
  }

  private async _fetchChargesStatus(orgId: string) {
    const [pendingCount, paidCount, overdueCount, canceledCount] = await Promise.all([
      this.prisma.charge.count({ where: { orgId, status: 'PENDING' } }),
      this.prisma.charge.count({ where: { orgId, status: 'PAID' } }),
      this.prisma.charge.count({ where: { orgId, status: 'OVERDUE' } }),
      this.prisma.charge.count({ where: { orgId, status: 'CANCELED' } }),
    ])
    return { pending: pendingCount, paid: paidCount, overdue: overdueCount, cancelled: canceledCount }
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
