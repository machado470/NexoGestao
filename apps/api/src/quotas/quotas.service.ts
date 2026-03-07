import { Injectable, Logger, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { SubscriptionStatus } from '@prisma/client'

export interface QuotaLimits {
  customers: number
  appointments: number
  serviceOrders: number
  users: number
  storage: number
}

export const PLAN_LIMITS: Record<string, QuotaLimits> = {
  FREE: {
    customers: 5,
    appointments: 20,
    serviceOrders: 10,
    users: 2,
    storage: 100,
  },
  STARTER: {
    customers: 30,
    appointments: 200,
    serviceOrders: 100,
    users: 5,
    storage: 500,
  },
  PRO: {
    customers: 100,
    appointments: 2000,
    serviceOrders: 1000,
    users: 10,
    storage: 5000,
  },
  BUSINESS: {
    customers: 999999,
    appointments: 999999,
    serviceOrders: 999999,
    users: 999999,
    storage: 999999,
  },
}

@Injectable()
export class QuotasService {

  private readonly logger = new Logger(QuotasService.name)

  constructor(private prisma: PrismaService) {}

  async getOrgPlan(orgId: string): Promise<string> {

    try {

      const subscription = await this.prisma.subscription.findUnique({
        where: { orgId },
        include: { plan: true },
      })

      if (!subscription) return 'FREE'

      if (
        subscription.status === SubscriptionStatus.CANCELED ||
        subscription.status === SubscriptionStatus.INACTIVE
      ) {
        return 'FREE'
      }

      if (
        subscription.status === SubscriptionStatus.TRIALING &&
        subscription.trialEndsAt &&
        subscription.trialEndsAt < new Date()
      ) {
        return 'FREE'
      }

      return subscription.plan.name

    } catch (err) {

      const message =
        err instanceof Error ? err.message : 'erro desconhecido'

      this.logger.warn(
        `Erro ao obter plano da org ${orgId}: ${message} — usando FREE`,
      )

      return 'FREE'

    }

  }

  getQuotaLimits(plan: string): QuotaLimits {
    return PLAN_LIMITS[plan] || PLAN_LIMITS['FREE']
  }

  async canCreateCustomer(orgId: string): Promise<boolean> {

    const plan = await this.getOrgPlan(orgId)
    const limits = this.getQuotaLimits(plan)

    if (limits.customers >= 999999) return true

    const count = await this.prisma.customer.count({ where: { orgId } })

    return count < limits.customers

  }

  async canCreateAppointment(orgId: string): Promise<boolean> {

    const plan = await this.getOrgPlan(orgId)
    const limits = this.getQuotaLimits(plan)

    if (limits.appointments >= 999999) return true

    const count = await this.prisma.appointment.count({
      where: { orgId },
    })

    return count < limits.appointments

  }

  async canCreateServiceOrder(orgId: string): Promise<boolean> {

    const plan = await this.getOrgPlan(orgId)
    const limits = this.getQuotaLimits(plan)

    if (limits.serviceOrders >= 999999) return true

    const count = await this.prisma.serviceOrder.count({
      where: { orgId },
    })

    return count < limits.serviceOrders

  }

  async canAddCollaborator(orgId: string): Promise<boolean> {

    const plan = await this.getOrgPlan(orgId)
    const limits = this.getQuotaLimits(plan)

    if (limits.users >= 999999) return true

    const count = await this.prisma.user.count({
      where: { orgId },
    })

    return count < limits.users

  }

  async getQuotaUsage(orgId: string) {

    const plan = await this.getOrgPlan(orgId)
    const limits = this.getQuotaLimits(plan)

    const [
      customerCount,
      appointmentCount,
      serviceOrderCount,
      userCount,
    ] = await Promise.all([
      this.prisma.customer.count({ where: { orgId } }),
      this.prisma.appointment.count({ where: { orgId } }),
      this.prisma.serviceOrder.count({ where: { orgId } }),
      this.prisma.user.count({ where: { orgId } }),
    ])

    const pct = (used: number, limit: number) =>
      limit >= 999999 ? 0 : Math.min(100, Math.round((used / limit) * 100))

    return {
      plan,
      limits,
      usage: {
        customers: {
          used: customerCount,
          limit: limits.customers,
          percentage: pct(customerCount, limits.customers),
          unlimited: limits.customers >= 999999,
        },
        appointments: {
          used: appointmentCount,
          limit: limits.appointments,
          percentage: pct(appointmentCount, limits.appointments),
          unlimited: limits.appointments >= 999999,
        },
        serviceOrders: {
          used: serviceOrderCount,
          limit: limits.serviceOrders,
          percentage: pct(serviceOrderCount, limits.serviceOrders),
          unlimited: limits.serviceOrders >= 999999,
        },
        users: {
          used: userCount,
          limit: limits.users,
          percentage: pct(userCount, limits.users),
          unlimited: limits.users >= 999999,
        },
      },
    }

  }

  async validateQuota(
    orgId: string,
    action:
      | 'CREATE_CUSTOMER'
      | 'CREATE_APPOINTMENT'
      | 'CREATE_SERVICE_ORDER'
      | 'ADD_COLLABORATOR',
  ): Promise<void> {

    const plan = await this.getOrgPlan(orgId)

    let canProceed = false
    let resourceName = ''

    switch (action) {

      case 'CREATE_CUSTOMER':
        canProceed = await this.canCreateCustomer(orgId)
        resourceName = 'cliente'
        break

      case 'CREATE_APPOINTMENT':
        canProceed = await this.canCreateAppointment(orgId)
        resourceName = 'agendamento'
        break

      case 'CREATE_SERVICE_ORDER':
        canProceed = await this.canCreateServiceOrder(orgId)
        resourceName = 'ordem de serviço'
        break

      case 'ADD_COLLABORATOR':
        canProceed = await this.canAddCollaborator(orgId)
        resourceName = 'colaborador'
        break

    }

    if (!canProceed) {

      this.logger.warn(
        `Quota excedida: ${action} | org=${orgId} | plano=${plan}`,
      )

      throw new ForbiddenException(
        `Limite de ${resourceName}s atingido para o plano ${plan}. ` +
          `Faça upgrade para continuar.`,
      )

    }

  }

}
