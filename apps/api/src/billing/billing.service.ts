import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import {
  PlanName,
  SubscriptionStatus,
  BillingEventType,
  BillingEventStatus,
} from '@prisma/client'
import Stripe from 'stripe'
import { QuotasService } from '../quotas/quotas.service'

const PLAN_PRICE_MAP: Record<string, string> = {
  FREE: '',
  STARTER: process.env.STRIPE_PRICE_STARTER ?? 'price_starter',
  PRO: process.env.STRIPE_PRICE_PRO ?? 'price_pro',
  BUSINESS: process.env.STRIPE_PRICE_BUSINESS ?? 'price_business',
  SCALE: process.env.STRIPE_PRICE_BUSINESS ?? 'price_business',
}

export const PLAN_LIMITS: Record<
  string,
  {
    customers: number
    users: number
    serviceOrders: number
    appointments: number
    label: string
  }
> = {
  FREE: {
    customers: 5,
    users: 2,
    serviceOrders: 10,
    appointments: 20,
    label: 'Free',
  },
  STARTER: {
    customers: 30,
    users: 5,
    serviceOrders: 100,
    appointments: 200,
    label: 'Starter',
  },
  PRO: {
    customers: 100,
    users: 10,
    serviceOrders: 1000,
    appointments: 2000,
    label: 'Pro',
  },
  SCALE: {
    customers: 999999,
    users: 999999,
    serviceOrders: 999999,
    appointments: 999999,
    label: 'Scale',
  },
  BUSINESS: {
    customers: 999999,
    users: 999999,
    serviceOrders: 999999,
    appointments: 999999,
    label: 'Scale',
  },
}

@Injectable()
export class BillingService {

  private readonly logger = new Logger(BillingService.name)
  private stripe: Stripe | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly quotasService: QuotasService,
  ) {

    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY')

    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' })
      this.logger.log('Stripe inicializado')
    } else {
      this.logger.warn('Stripe não configurado — modo simulado')
    }

  }

  get isStripeConfigured(): boolean {
    return this.stripe !== null
  }

  private normalizePlanName(planName: string): string {
    if (planName === 'BUSINESS') return 'SCALE'
    return planName
  }

  private assertStripeAvailable(operation: string) {

    if (this.stripe) return

    if (this.config.get<string>('NODE_ENV') === 'production') {
      throw new ServiceUnavailableException(
        `Stripe não configurado (${operation})`,
      )
    }

  }

  /*
  ========================================
  CHECKOUT
  ========================================
  */

  async createCheckoutSession(
    orgId: string,
    planName: PlanName,
    successUrl?: string,
    cancelUrl?: string,
  ) {

    if (!this.stripe) {
      return this.simulateCheckoutSession(orgId, planName)
    }

    const normalizedPlanName = this.normalizePlanName(planName)
    const priceId = PLAN_PRICE_MAP[normalizedPlanName]

    if (!priceId) {
      throw new Error(`Plano ${planName} não possui priceId`)
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl ?? 'http://localhost:5173/billing/success',
      cancel_url: cancelUrl ?? 'http://localhost:5173/billing/cancel',
      metadata: { orgId, planName: normalizedPlanName },
    })

    return {
      url: session.url,
      sessionId: session.id,
    }

  }

  /*
  ========================================
  WEBHOOK
  ========================================
  */

  async handleWebhook(rawBody: Buffer, signature: string) {

    if (!this.stripe) {
      this.logger.warn('Webhook recebido mas Stripe não configurado')
      return { received: true, simulated: true }
    }

    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')

    if (!secret) {
      throw new ServiceUnavailableException(
        'STRIPE_WEBHOOK_SECRET não configurado',
      )
    }

    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      secret,
    )

    this.logger.log(`Webhook recebido: ${event.type}`)

    return { received: true }

  }

  /*
  ========================================
  SUBSCRIPTION
  ========================================
  */

  async getSubscription(orgId: string) {

    const subscription = await this.prisma.subscription.findUnique({
      where: { orgId },
      include: { plan: true },
    })

    if (!subscription) {
      return {
        status: 'NO_SUBSCRIPTION',
        plan: null,
        limits: PLAN_LIMITS.FREE,
      }
    }

    const planName = this.normalizePlanName(subscription.plan.name)

    return {
      ...subscription,
      limits: PLAN_LIMITS[planName] ?? PLAN_LIMITS.FREE,
    }

  }

  async getBillingStatus(orgId: string) {

    const subscription = await this.prisma.subscription.findUnique({
      where: { orgId },
      include: { plan: true },
    })

    if (!subscription) {
      return {
        status: 'NO_SUBSCRIPTION',
        plan: 'FREE',
        isActive: false,
      }
    }

    const planName = this.normalizePlanName(subscription.plan.name)

    return {
      status: subscription.status,
      plan: planName,
      isActive:
        subscription.status === SubscriptionStatus.ACTIVE ||
        subscription.status === SubscriptionStatus.TRIALING,
      currentPeriodEnd: subscription.currentPeriodEnd,
    }

  }

  async cancelSubscription(orgId: string) {

    const subscription = await this.prisma.subscription.findUnique({
      where: { orgId },
    })

    if (!subscription) {
      throw new NotFoundException('Nenhuma assinatura encontrada')
    }

    return this.prisma.subscription.update({
      where: { orgId },
      data: {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
      },
    })

  }

  /*
  ========================================
  SIMULATED CHECKOUT
  ========================================
  */

  async simulateCheckoutSession(orgId: string, planName: PlanName) {

    this.logger.warn(`Checkout simulado para ${orgId} (${planName})`)

    const plan = await this.prisma.plan.findUnique({
      where: { name: planName },
    })

    if (!plan) {
      throw new NotFoundException(`Plano ${planName} não encontrado`)
    }

    const subscription = await this.prisma.subscription.upsert({
      where: { orgId },
      create: {
        orgId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 86400000),
      },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
      },
    })

    await this.prisma.billingEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: BillingEventType.PAYMENT,
        amountCents: plan.priceCents,
        status: BillingEventStatus.COMPLETED,
        description: '[SIMULADO] checkout',
      },
    })

    return {
      simulated: true,
      sessionId: `sim_${Date.now()}`,
    }

  }

  /*
  ========================================
  LIMITES
  ========================================
  */

  async getBillingLimits(orgId: string) {
    return this.quotasService.getQuotaUsage(orgId)
  }

}
