import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Retorna métricas operacionais gerais do sistema
   */
  async getMetrics(orgId: string) {
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
      // 1. Total de clientes ativos
      this.prisma.customer.count({
        where: { orgId, active: true },
      }),

      // 2. Total de ordens de serviço
      this.prisma.serviceOrder.count({
        where: { orgId },
      }),

      // 3. Ordens de serviço abertas (OPEN ou ASSIGNED)
      this.prisma.serviceOrder.count({
        where: { orgId, status: { in: ['OPEN', 'ASSIGNED'] } },
      }),

      // 4. Ordens de serviço atrasadas (não concluídas e data agendada passou)
      this.prisma.serviceOrder.count({
        where: {
          orgId,
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
          scheduledFor: { lt: now },
        },
      }),

      // 5. Faturamento semanal (pagamentos realizados nesta semana)
      this.prisma.payment.aggregate({
        where: {
          orgId,
          paidAt: { gte: startOfWeek },
        },
        _sum: { amountCents: true },
      }),

      // 6. Pagamentos pendentes (cobranças PENDING ou OVERDUE)
      this.prisma.charge.aggregate({
        where: {
          orgId,
          status: { in: ['PENDING', 'OVERDUE'] },
        },
        _sum: { amountCents: true },
      }),

      // Métricas adicionais para compatibilidade
      this.prisma.serviceOrder.count({
        where: { orgId, status: 'IN_PROGRESS' },
      }),
      this.prisma.serviceOrder.count({
        where: { orgId, status: 'DONE' },
      }),
      this.prisma.serviceOrder.count({
        where: {
          orgId,
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
          scheduledFor: { lt: now },
        },
      }),
      this.prisma.correctiveAction.count({
        where: { person: { orgId }, status: 'OPEN' },
      }),
      this.prisma.charge.aggregate({
        where: { orgId },
        _sum: { amountCents: true },
      }),
      this.prisma.charge.aggregate({
        where: { orgId, status: 'PAID' },
        _sum: { amountCents: true },
      }),
      this.prisma.charge.aggregate({
        where: { orgId, status: { in: ['PENDING', 'OVERDUE'] } },
        _sum: { amountCents: true },
      }),
    ])

    return {
      // Novas métricas solicitadas
      totalCustomers,
      openServiceOrders,
      overdueServiceOrders,
      weeklyRevenueInCents: weeklyRevenueAgg._sum.amountCents ?? 0,
      pendingPaymentsInCents: pendingPaymentsAgg._sum.amountCents ?? 0,

      // Métricas existentes (compatibilidade)
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
   * Retorna dados de faturamento por período (últimos 12 meses)
   */
  async getRevenueData(orgId: string) {
    const now = new Date()
    const months: Array<{
      month: string
      date: Date
      revenue: number
    }> = []

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = date.toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      })

      months.push({
        month: monthName,
        date,
        revenue: 0,
      })
    }

    const payments = await this.prisma.payment.findMany({
      where: {
        orgId,
        paidAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 11, 1),
        },
      },
      select: {
        amountCents: true,
        paidAt: true,
      },
    })

    payments.forEach((payment) => {
      const paymentMonth = new Date(
        payment.paidAt.getFullYear(),
        payment.paidAt.getMonth(),
        1,
      )

      const monthIndex = months.findIndex(
        (m) =>
          m.date.getFullYear() === paymentMonth.getFullYear() &&
          m.date.getMonth() === paymentMonth.getMonth(),
      )

      if (monthIndex !== -1) {
        months[monthIndex].revenue += payment.amountCents
      }
    })

    return months.map((m) => ({
      month: m.month,
      revenue: m.revenue / 100,
    }))
  }

  /**
   * Retorna crescimento de clientes por mês (últimos 12 meses)
   */
  async getCustomerGrowth(orgId: string) {
    const now = new Date()
    const months: Array<{
      month: string
      date: Date
      newCustomers: number
      totalCustomers: number
    }> = []

    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthName = date.toLocaleDateString('pt-BR', {
        month: 'short',
        year: '2-digit',
      })

      months.push({
        month: monthName,
        date,
        newCustomers: 0,
        totalCustomers: 0,
      })
    }

    const customers = await this.prisma.customer.findMany({
      where: {
        orgId,
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 11, 1),
        },
      },
      select: {
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    customers.forEach((customer) => {
      const customerMonth = new Date(
        customer.createdAt.getFullYear(),
        customer.createdAt.getMonth(),
        1,
      )

      const monthIndex = months.findIndex(
        (m) =>
          m.date.getFullYear() === customerMonth.getFullYear() &&
          m.date.getMonth() === customerMonth.getMonth(),
      )

      if (monthIndex !== -1) {
        months[monthIndex].newCustomers += 1
      }
    })

    let cumulative = 0
    months.forEach((m) => {
      cumulative += m.newCustomers
      m.totalCustomers = cumulative
    })

    return months.map((m) => ({
      month: m.month,
      newCustomers: m.newCustomers,
      totalCustomers: m.totalCustomers,
    }))
  }

  /**
   * Retorna status detalhado das ordens de serviço
   */
  async getServiceOrdersStatus(orgId: string) {
    const [
      openCount,
      assignedCount,
      inProgressCount,
      doneCount,
      canceledCount,
    ] = await Promise.all([
      this.prisma.serviceOrder.count({
        where: { orgId, status: 'OPEN' },
      }),
      this.prisma.serviceOrder.count({
        where: { orgId, status: 'ASSIGNED' },
      }),
      this.prisma.serviceOrder.count({
        where: { orgId, status: 'IN_PROGRESS' },
      }),
      this.prisma.serviceOrder.count({
        where: { orgId, status: 'DONE' },
      }),
      this.prisma.serviceOrder.count({
        where: { orgId, status: 'CANCELED' },
      }),
    ])

    return {
      open: openCount,
      assigned: assignedCount,
      inProgress: inProgressCount,
      completed: doneCount,
      cancelled: canceledCount,
    }
  }

  /**
   * Retorna status detalhado das cobranças
   */
  async getChargesStatus(orgId: string) {
    const [
      pendingCount,
      paidCount,
      overdueCount,
      canceledCount,
    ] = await Promise.all([
      this.prisma.charge.count({
        where: { orgId, status: 'PENDING' },
      }),
      this.prisma.charge.count({
        where: { orgId, status: 'PAID' },
      }),
      this.prisma.charge.count({
        where: { orgId, status: 'OVERDUE' },
      }),
      this.prisma.charge.count({
        where: { orgId, status: 'CANCELED' },
      }),
    ])

    return {
      pending: pendingCount,
      paid: paidCount,
      overdue: overdueCount,
      cancelled: canceledCount,
    }
  }
}
