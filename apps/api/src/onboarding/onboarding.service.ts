import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

type OnboardingStep = 'createCustomer' | 'createService' | 'createCharge'

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async getOnboardingStatus(orgId: string) {
    const [organization, customerCount, serviceOrderCount, chargeCount] =
      await Promise.all([
        this.prisma.organization.findUnique({
          where: { id: orgId },
          select: { requiresOnboarding: true },
        }),
        this.prisma.customer.count({ where: { orgId } }),
        this.prisma.serviceOrder.count({ where: { orgId } }),
        this.prisma.charge.count({ where: { orgId } }),
      ])

    if (!organization) {
      return null
    }

    const createCustomer = customerCount > 0
    const createService = serviceOrderCount > 0
    const createCharge = chargeCount > 0
    const shouldComplete = createCustomer && createService && createCharge

    if (organization.requiresOnboarding && shouldComplete) {
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { requiresOnboarding: false },
      })
      organization.requiresOnboarding = false
    }

    return {
      requiresOnboarding: organization.requiresOnboarding,
      steps: {
        createCustomer,
        createService,
        createCharge,
      },
    }
  }

  async completeOnboardingStep(orgId: string, step: OnboardingStep) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, requiresOnboarding: true },
    })

    if (!org) return null

    if (step === 'createCharge' && org.requiresOnboarding) {
      await this.prisma.organization.update({
        where: { id: orgId },
        data: {
          requiresOnboarding: false,
        },
      })
    }

    return this.getOnboardingStatus(orgId)
  }
}
