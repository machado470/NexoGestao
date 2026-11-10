import { Injectable, NotFoundException, MethodNotAllowedException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { PlansService } from '../plans/plans.service'
import {
  PlanName,
  // PrismaClient,
  SubscriptionStatus,
} from '@prisma/client'

type DbClient = any

@Injectable()
export class SubscriptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
  ) {}

  async createTrialSubscription(orgId: string, tx?: DbClient) {
    const db = tx ?? this.prisma

    const starterPlan = await this.plansService.findPlanByName(PlanName.STARTER)

    if (!starterPlan) {
      throw new NotFoundException(
        'Plano STARTER não encontrado. Configure os planos padrão primeiro.',
      )
    }

    const now = new Date()
    const trialEnd = new Date()
    trialEnd.setDate(trialEnd.getDate() + 14)

    const existing = await db.subscription.findUnique({
      where: { orgId },
      include: { plan: true },
    })

    if (existing) {
      return existing
    }

    return db.subscription.create({
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
    // Reads must not create trials or override a provider-managed lifecycle.
    return this.getOrganizationSubscription(orgId)
  }

  async updateSubscription(_orgId: string, _planName: PlanName) {
    throw new MethodNotAllowedException(
      'Ativação direta de plano desativada. Use POST /billing/create-checkout-session; a confirmação do provedor ativa a assinatura.',
    )
  }

  async getOrganizationSubscription(orgId: string) {
    return this.prisma.subscription.findUnique({
      where: { orgId },
      include: { plan: true },
    })
  }
}
