import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import type { OnboardingStep } from './dto/complete-onboarding-step.dto'

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  /** Status reads never release the organization or accept client-side progress as evidence. */
  async getOnboardingStatus(orgId: string) {
    const [organization, customerCount, serviceOrderCount, chargeCount] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: orgId }, select: { requiresOnboarding: true } }),
      this.prisma.customer.count({ where: { orgId } }),
      this.prisma.serviceOrder.count({ where: { orgId, status: 'DONE' } }),
      this.prisma.charge.count({ where: {
        orgId,
        status: { in: ['PENDING', 'OVERDUE', 'PAID'] },
        customer: { is: { orgId } },
        serviceOrder: { is: { orgId, status: 'DONE' } },
      } }),
    ])
    if (!organization) return null
    return {
      requiresOnboarding: organization.requiresOnboarding,
      steps: { createCustomer: customerCount > 0, createService: serviceOrderCount > 0, createCharge: chargeCount > 0 },
    }
  }

  async completeOnboarding(orgId: string) {
    const status = await this.getOnboardingStatus(orgId)
    if (!status || !status.requiresOnboarding) return status
    if (!Object.values(status.steps).every(Boolean)) {
      throw new BadRequestException('Cadastre um cliente, conclua uma O.S. e gere uma cobrança vinculada antes de finalizar o onboarding.')
    }
    await this.prisma.organization.update({ where: { id: orgId }, data: { requiresOnboarding: false } })
    return { ...status, requiresOnboarding: false }
  }

  async completeOnboardingStep(orgId: string, step: OnboardingStep) {
    return step === 'createCharge' ? this.completeOnboarding(orgId) : this.getOnboardingStatus(orgId)
  }
}
