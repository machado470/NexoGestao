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
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    const [
      totalCustomers,
      totalServiceOrders,
      inProgressOrders,
      completedOrders,
      delayedOrders,
      riskTickets,
      totalRevenue,
      paidRevenue,
      pendingRevenue,
    ] = await Promise.all([
      // Total de clientes
      this.prisma.customer.count({
        where: { orgId, status: 'ACTIVE' },
      }),

      // Total de ordens de serviço
      this.prisma.serviceOrder.count({
        where: { orgId },
      }),

      // Ordens em andamento
      this.prisma.serviceOrder.count({
        where: {
          orgId,
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
        },
      }),

      // Ordens concluídas
      this.prisma.serviceOrder.count({
        where: {
          orgId,
          status: 'COMPLETED',
        },
      }),

      // Ordens atrasadas (finishedAt passou da data agendada)
      this.prisma.serviceOrder.count({
        where: {
          orgId,
          status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
          scheduledFor: {
            lt: now,
          },
        },
      }),

      // Tickets de risco (CorrectiveActions abertas)
      this.prisma.correctiveAction.count({
        where: {
          person: {
            org: { id: orgId },
          },
          status: 'OPEN',
        },
      }),

      // Faturamento total (todas as cobranças)
      this.prisma.charge.aggregate({
        where: { orgId },
        _sum: { amountCents: true },
      }),

      // Faturamento pago
      this.prisma.charge.aggregate({
        where: { orgId, status: 'PAID' },
        _sum: { amountCents: true },
      }),

      // Faturamento pendente
      this.prisma.charge.aggregate({
        where: { orgId, status: { in: ['PENDING', 'OVERDUE'] } },
        _sum: { amountCents: true },
      }),
    ])

    return {
      totalCustomers,
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

    // Gera os últimos 12 meses
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

    // Busca pagamentos por mês
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

    // Agrupa pagamentos por mês
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
      revenue: m.revenue / 100, // Converte cents para reais
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

    // Gera os últimos 12 meses
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

    // Busca todos os clientes criados nos últimos 12 meses
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

    // Conta clientes por mês
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

    // Calcula total acumulado
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
      completedCount,
      cancelledCount,
      onHoldCount,
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
        where: { orgId, status: 'COMPLETED' },
      }),
      this.prisma.serviceOrder.count({
        where: { orgId, status: 'CANCELLED' },
      }),
      this.prisma.serviceOrder.count({
        where: { orgId, status: 'ON_HOLD' },
      }),
    ])

    return {
      open: openCount,
      assigned: assignedCount,
      inProgress: inProgressCount,
      completed: completedCount,
      cancelled: cancelledCount,
      onHold: onHoldCount,
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
      cancelledCount,
      refundedCount,
      partialCount,
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
        where: { orgId, status: 'CANCELLED' },
      }),
      this.prisma.charge.count({
        where: { orgId, status: 'REFUNDED' },
      }),
      this.prisma.charge.count({
        where: { orgId, status: 'PARTIAL' },
      }),
    ])

    return {
      pending: pendingCount,
      paid: paidCount,
      overdue: overdueCount,
      cancelled: cancelledCount,
      refunded: refundedCount,
      partial: partialCount,
    }
  }
}
