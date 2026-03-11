import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PlansService } from '../plans/plans.service'
import { PlanName, SubscriptionStatus } from '@prisma/client'

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
  ) {}

  async createTrialSubscription(orgId: string) {
    const starterPlan = await this.plansService.findPlanByName(PlanName.STARTER)

    if (!starterPlan) {
      throw new NotFoundException(
        'Plano STARTER não encontrado. Configure os planos padrão primeiro.',
      )
    }

    const now = new Date()
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)

    const existing = await this.prisma.subscription.findUnique({
      where: { orgId },
      include: { plan: true },
    })

    if (existing) {
      return existing
    }

    return this.prisma.subscription.create({
      data: {
        orgId,
        planId: starterPlan.id,
        status: SubscriptionStatus.TRIALING,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
      },
      include: { plan: true },
    })
  }

  async checkSubscriptionStatus(orgId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { orgId },
      include: { plan: true },
    })

    if (!subscription) {
      return this.createTrialSubscription(orgId)
    }

    if (
      subscription.status === SubscriptionStatus.TRIALING &&
      subscription.currentPeriodEnd < new Date()
    ) {
      return this.prisma.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.CANCELED },
        include: { plan: true },
      })
    }

    return subscription
  }

  async updateSubscription(orgId: string, planName: PlanName) {
    const currentSubscription = await this.prisma.subscription.findUnique({
      where: { orgId },
    })

    if (!currentSubscription) {
      throw new NotFoundException(
        'Nenhuma assinatura encontrada para esta organização.',
      )
    }

    const newPlan = await this.plansService.findPlanByName(planName)

    if (!newPlan) {
      throw new NotFoundException(`Plano ${planName} não encontrado.`)
    }

    const now = new Date()
    const nextPeriodEnd = new Date(now)
    nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1)

    return this.prisma.subscription.update({
      where: { id: currentSubscription.id },
      data: {
        planId: newPlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: now,
        currentPeriodEnd: nextPeriodEnd,
      },
      include: { plan: true },
    })
  }

  async cancelSubscription(orgId: string) {
    const currentSubscription = await this.prisma.subscription.findUnique({
      where: { orgId },
    })

    if (!currentSubscription) {
      throw new NotFoundException(
        'Nenhuma assinatura encontrada para esta organização.',
      )
    }

    return this.prisma.subscription.update({
      where: { id: currentSubscription.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
      },
      include: { plan: true },
    })
  }

  async getOrganizationSubscription(orgId: string) {
    return this.prisma.subscription.findUnique({
      where: { orgId },
      include: { plan: true },
    })
  }
}
