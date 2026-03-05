import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlansService } from '../plans/plans.service';
import { PlanName, SubscriptionStatus } from '@prisma/client';

@Injectable()
export class SubscriptionsService {
  constructor(
    private prisma: PrismaService,
    private plansService: PlansService,
  ) {}

  async createTrialSubscription(orgId: string) {
    const starterPlan = await this.plansService.findPlanByName(PlanName.STARTER);
    if (!starterPlan) {
      throw new NotFoundException('Plano STARTER não encontrado. Configure os planos padrão primeiro.');
    }

    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14 dias de trial

    const subscription = await this.prisma.subscription.create({
      data: {
        orgId,
        planId: starterPlan.id,
        status: SubscriptionStatus.TRIALING,
        trialEndsAt,
        currentPeriodStart: new Date(),
        currentPeriodEnd: trialEndsAt,
      },
    });

    // Marcar a organização como já tendo feito trial
    await this.prisma.organization.update({
      where: { id: orgId },
      data: { hasTrialed: true },
    });

    return subscription;
  }

  async checkSubscriptionStatus(orgId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { orgId },
      include: { plan: true },
    });

    if (!subscription) {
      // Se não houver assinatura, verificar se a organização já fez trial
      const organization = await this.prisma.organization.findUnique({ where: { id: orgId } });
      if (organization && !organization.hasTrialed) {
        // Se não fez trial, criar um trial automático
        return this.createTrialSubscription(orgId);
      }
      // Se já fez trial e não tem assinatura, está inativa
      return { status: SubscriptionStatus.INACTIVE, message: 'Nenhuma assinatura ativa. Trial já utilizado.' };
    }

    // Lógica para atualizar o status do trial
    if (subscription.status === SubscriptionStatus.TRIALING && subscription.trialEndsAt && subscription.trialEndsAt < new Date()) {
      // Trial expirou, mudar para INACTIVE
      return this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.INACTIVE },
      });
    }

    return subscription;
  }

  async updateSubscription(orgId: string, planName: PlanName) {
    const currentSubscription = await this.prisma.subscription.findUnique({ where: { orgId } });
    if (!currentSubscription) {
      throw new NotFoundException('Nenhuma assinatura encontrada para esta organização.');
    }

    const newPlan = await this.plansService.findPlanByName(planName);
    if (!newPlan) {
      throw new NotFoundException(`Plano ${planName} não encontrado.`);
    }

    // Lógica de upgrade/downgrade, cálculo de pro-rata, etc. (simplificado aqui)
    return this.prisma.subscription.update({
      where: { id: currentSubscription.id },
      data: {
        planId: newPlan.id,
        status: SubscriptionStatus.ACTIVE, // Assumindo que a atualização implica em ativação
        trialEndsAt: null, // Remove o trial se estiver ativo
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(new Date().setMonth(new Date().getMonth() + 1)), // Exemplo: 1 mês
      },
    });
  }

  async cancelSubscription(orgId: string) {
    const currentSubscription = await this.prisma.subscription.findUnique({ where: { orgId } });
    if (!currentSubscription) {
      throw new NotFoundException('Nenhuma assinatura encontrada para esta organização.');
    }

    return this.prisma.subscription.update({
      where: { id: currentSubscription.id },
      data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
    });
  }

  async getOrganizationSubscription(orgId: string) {
    return this.prisma.subscription.findUnique({
      where: { orgId },
      include: { plan: true },
    });
  }
}
