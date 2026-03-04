import { Injectable, Logger, ForbiddenException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

interface QuotaLimits {
  customers: number
  appointments: number
  serviceOrders: number
  collaborators: number
  storage: number // em MB
}

const PLAN_LIMITS: Record<string, QuotaLimits> = {
  FREE: {
    customers: 5,
    appointments: 10,
    serviceOrders: 5,
    collaborators: 1,
    storage: 100,
  },
  PRO: {
    customers: 50,
    appointments: 100,
    serviceOrders: 50,
    collaborators: 5,
    storage: 1000,
  },
  ENTERPRISE: {
    customers: 999999,
    appointments: 999999,
    serviceOrders: 999999,
    collaborators: 999999,
    storage: 999999,
  },
}

@Injectable()
export class QuotasService {
  private readonly logger = new Logger(QuotasService.name)

  constructor(private prisma: PrismaService) {}

  /**
   * Obtém o plano de uma organização
   */
  async getOrgPlan(orgId: string): Promise<string> {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { plan: true },
    })

    return org?.plan || 'FREE'
  }

  /**
   * Obtém os limites de quota para um plano
   */
  getQuotaLimits(plan: string): QuotaLimits {
    return PLAN_LIMITS[plan] || PLAN_LIMITS['FREE']
  }

  /**
   * Verifica se a organização pode criar um novo cliente
   */
  async canCreateCustomer(orgId: string): Promise<boolean> {
    const plan = await this.getOrgPlan(orgId)
    const limits = this.getQuotaLimits(plan)

    const customerCount = await this.prisma.customer.count({
      where: { orgId },
    })

    return customerCount < limits.customers
  }

  /**
   * Verifica se a organização pode criar um novo agendamento
   */
  async canCreateAppointment(orgId: string): Promise<boolean> {
    const plan = await this.getOrgPlan(orgId)
    const limits = this.getQuotaLimits(plan)

    const appointmentCount = await this.prisma.appointment.count({
      where: { orgId },
    })

    return appointmentCount < limits.appointments
  }

  /**
   * Verifica se a organização pode criar uma nova ordem de serviço
   */
  async canCreateServiceOrder(orgId: string): Promise<boolean> {
    const plan = await this.getOrgPlan(orgId)
    const limits = this.getQuotaLimits(plan)

    const serviceOrderCount = await this.prisma.serviceOrder.count({
      where: { orgId },
    })

    return serviceOrderCount < limits.serviceOrders
  }

  /**
   * Verifica se a organização pode adicionar um novo colaborador
   */
  async canAddCollaborator(orgId: string): Promise<boolean> {
    const plan = await this.getOrgPlan(orgId)
    const limits = this.getQuotaLimits(plan)

    const collaboratorCount = await this.prisma.user.count({
      where: { orgId },
    })

    return collaboratorCount < limits.collaborators
  }

  /**
   * Obtém o uso atual de quotas de uma organização
   */
  async getQuotaUsage(orgId: string) {
    const plan = await this.getOrgPlan(orgId)
    const limits = this.getQuotaLimits(plan)

    const [customerCount, appointmentCount, serviceOrderCount, collaboratorCount] = await Promise.all([
      this.prisma.customer.count({ where: { orgId } }),
      this.prisma.appointment.count({ where: { orgId } }),
      this.prisma.serviceOrder.count({ where: { orgId } }),
      this.prisma.user.count({ where: { orgId } }),
    ])

    return {
      plan,
      limits,
      usage: {
        customers: {
          used: customerCount,
          limit: limits.customers,
          percentage: Math.round((customerCount / limits.customers) * 100),
        },
        appointments: {
          used: appointmentCount,
          limit: limits.appointments,
          percentage: Math.round((appointmentCount / limits.appointments) * 100),
        },
        serviceOrders: {
          used: serviceOrderCount,
          limit: limits.serviceOrders,
          percentage: Math.round((serviceOrderCount / limits.serviceOrders) * 100),
        },
        collaborators: {
          used: collaboratorCount,
          limit: limits.collaborators,
          percentage: Math.round((collaboratorCount / limits.collaborators) * 100),
        },
      },
    }
  }

  /**
   * Valida se uma ação é permitida pela quota
   */
  async validateQuota(
    orgId: string,
    action: 'CREATE_CUSTOMER' | 'CREATE_APPOINTMENT' | 'CREATE_SERVICE_ORDER' | 'ADD_COLLABORATOR',
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
      const limits = this.getQuotaLimits(plan)
      this.logger.warn(`Quota excedida para ${action} no plano ${plan}`)

      throw new ForbiddenException(
        `Limite de ${resourceName}s atingido para o plano ${plan}. Faça upgrade para continuar.`,
      )
    }
  }
}
