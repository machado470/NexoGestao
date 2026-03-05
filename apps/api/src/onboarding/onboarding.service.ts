import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Mapeamento de passos de onboarding para valores de onboardingStep
 * O schema usa onboardingStep (Int) e requiresOnboarding (Boolean)
 * Mapeamento:
 *   0 = nenhum passo concluído
 *   1 = createCustomer concluído
 *   2 = createService concluído
 *   3 = createCharge concluído (onboarding completo)
 */
const STEP_MAP: Record<string, number> = {
  createCustomer: 1,
  createService: 2,
  createCharge: 3,
}

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async getOnboardingStatus(orgId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { requiresOnboarding: true, onboardingStep: true },
    });

    if (!organization) {
      return null;
    }

    const step = organization.onboardingStep ?? 0;

    return {
      requiresOnboarding: organization.requiresOnboarding,
      steps: {
        createCustomer: step >= 1,
        createService: step >= 2,
        createCharge: step >= 3,
      },
    };
  }

  async completeOnboardingStep(orgId: string, step: 'createCustomer' | 'createService' | 'createCharge') {
    const stepValue = STEP_MAP[step] ?? 0;

    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { onboardingStep: true, requiresOnboarding: true },
    });

    if (!org) return null;

    // Só avança se o passo atual for menor que o novo passo
    if ((org.onboardingStep ?? 0) < stepValue) {
      const isComplete = stepValue >= 3;

      await this.prisma.organization.update({
        where: { id: orgId },
        data: {
          onboardingStep: stepValue,
          ...(isComplete ? { requiresOnboarding: false } : {}),
        },
      });
    }

    return this.getOnboardingStatus(orgId);
  }
}
