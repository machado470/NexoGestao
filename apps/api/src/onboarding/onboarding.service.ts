import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(private prisma: PrismaService) {}

  async getOnboardingStatus(orgId: string) {
    const organization = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { requiresOnboarding: true, hasCreatedCustomer: true, hasCreatedService: true, hasCreatedCharge: true },
    });

    if (!organization) {
      return null; // Ou lançar uma exceção, dependendo do fluxo desejado
    }

    return {
      requiresOnboarding: organization.requiresOnboarding,
      steps: {
        createCustomer: organization.hasCreatedCustomer,
        createService: organization.hasCreatedService,
        createCharge: organization.hasCreatedCharge,
      },
    };
  }

  async completeOnboardingStep(orgId: string, step: 'createCustomer' | 'createService' | 'createCharge') {
    const dataToUpdate: any = {};
    if (step === 'createCustomer') {
      dataToUpdate.hasCreatedCustomer = true;
    } else if (step === 'createService') {
      dataToUpdate.hasCreatedService = true;
    } else if (step === 'createCharge') {
      dataToUpdate.hasCreatedCharge = true;
    }

    await this.prisma.organization.update({
      where: { id: orgId },
      data: dataToUpdate,
    });

    // Verificar se todos os passos foram concluídos para desativar o onboarding
    const updatedOrg = await this.prisma.organization.findUnique({
      where: { id: orgId },
      select: { hasCreatedCustomer: true, hasCreatedService: true, hasCreatedCharge: true },
    });

    if (updatedOrg.hasCreatedCustomer && updatedOrg.hasCreatedService && updatedOrg.hasCreatedCharge) {
      await this.prisma.organization.update({
        where: { id: orgId },
        data: { requiresOnboarding: false },
      });
    }

    return this.getOnboardingStatus(orgId);
  }
}
