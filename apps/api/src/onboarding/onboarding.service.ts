import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

type OnboardingStep = 'createCustomer' | 'createService' | 'createCharge'

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async getOnboardingStatus(orgId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { requiresOnboarding: true },
    })

    if (!organization) {
      return null
    }

    const completed = organization.requiresOnboarding === false

    return {
      requiresOnboarding: organization.requiresOnboarding,
      steps: {
        createCustomer: completed,
        createService: completed,
        createCharge: completed,
      },
    }
  }

  async completeOnboardingStep(orgId: string, step: OnboardingStep) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, requiresOnboarding: true },
    })

    if (!org) return null

    // Sem coluna onboardingStep no schema atual.
    // Então só concluímos o onboarding de verdade no passo final.
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
