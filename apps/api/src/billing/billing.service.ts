import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { PlanName, SubscriptionStatus, BillingEventType, BillingEventStatus } from '@prisma/client'
import Stripe from 'stripe'

// Mapeamento de planos para Price IDs do Stripe (configurar via env)
const PLAN_PRICE_MAP: Record<string, string> = {
  FREE: '',
  STARTER: process.env.STRIPE_PRICE_STARTER ?? 'price_starter',
  PRO: process.env.STRIPE_PRICE_PRO ?? 'price_pro',
  BUSINESS: process.env.STRIPE_PRICE_BUSINESS ?? 'price_business',
}

// Limites por plano
export const PLAN_LIMITS: Record<string, {
  customers: number
  users: number
  serviceOrders: number
  appointments: number
  label: string
}> = {
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
  BUSINESS: {
    customers: 999999,
    users: 999999,
    serviceOrders: 999999,
    appointments: 999999,
    label: 'Business',
  },
}

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name)
  private stripe: Stripe | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const secretKey = this.config.get<string>('STRIPE_SECRET_KEY')
    if (secretKey) {
      this.stripe = new Stripe(secretKey, {
        apiVersion: '2024-06-20',
      })
      this.logger.log('Stripe inicializado com sucesso')
    } else {
      this.logger.warn('STRIPE_SECRET_KEY não configurado — billing em modo simulado')
    }
  }

  // ─── Criar Checkout Session ────────────────────────────────────────────────

  async createCheckoutSession(orgId: string, planName: PlanName, successUrl: string, cancelUrl: string) {
    if (!this.stripe) {
      return this.simulateCheckoutSession(orgId, planName)
    }

    const plan = await this.prisma.plan.findUnique({ where: { name: planName } })
    if (!plan) throw new NotFoundException(`Plano ${planName} não encontrado`)

    const priceId = PLAN_PRICE_MAP[planName]
    if (!priceId) throw new BadRequestException(`Plano ${planName} não possui Price ID configurado no Stripe`)

    const subscription = await this.prisma.subscription.findUnique({ where: { orgId } })
    const org = await this.prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) throw new NotFoundException('Organização não encontrada')

    let customerId = subscription?.stripeCustomerId

    // Criar ou reutilizar customer no Stripe
    if (!customerId) {
      const customer = await this.stripe.customers.create({
        name: org.name,
        metadata: { orgId, slug: org.slug },
      })
      customerId = customer.id

      if (subscription) {
        await this.prisma.subscription.update({
          where: { orgId },
          data: { stripeCustomerId: customerId },
        })
      }
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl ?? `${this.config.get('FRONTEND_URL')}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl ?? `${this.config.get('FRONTEND_URL')}/billing/cancel`,
      metadata: { orgId, planName },
      subscription_data: {
        metadata: { orgId, planName },
      },
    })

    // Salvar session ID
    if (subscription) {
      await this.prisma.subscription.update({
        where: { orgId },
        data: { stripeCheckoutSessionId: session.id },
      })
    }

    this.logger.log(`Checkout session criada para org ${orgId}: ${session.id}`)
    return { url: session.url, sessionId: session.id }
  }

  // ─── Processar Webhook do Stripe ──────────────────────────────────────────

  async handleWebhook(rawBody: Buffer, signature: string) {
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')

    if (!this.stripe || !webhookSecret) {
      this.logger.warn('Webhook recebido mas Stripe não configurado')
      return { received: true, simulated: true }
    }

    let event: Stripe.Event
    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret)
    } catch (err) {
      this.logger.error(`Webhook signature inválida: ${err.message}`)
      throw new BadRequestException(`Webhook Error: ${err.message}`)
    }

    this.logger.log(`Webhook recebido: ${event.type} (${event.id})`)

    // Idempotência: verificar se já processamos este evento
    const existing = await this.prisma.billingEvent.findUnique({
      where: { stripeEventId: event.id },
    })
    if (existing) {
      this.logger.log(`Evento ${event.id} já processado — ignorando`)
      return { received: true, duplicate: true }
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, event.id)
        break

      case 'customer.subscription.updated':
        await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription, event.id)
        break

      case 'customer.subscription.deleted':
        await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription, event.id)
        break

      case 'invoice.payment_succeeded':
        await this.handlePaymentSucceeded(event.data.object as Stripe.Invoice, event.id)
        break

      case 'invoice.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.Invoice, event.id)
        break

      default:
        this.logger.log(`Evento não tratado: ${event.type}`)
    }

    return { received: true }
  }

  // ─── Handlers de Webhook ──────────────────────────────────────────────────

  private async handleCheckoutCompleted(session: Stripe.Checkout.Session, eventId: string) {
    const orgId = session.metadata?.orgId
    const planName = session.metadata?.planName as PlanName

    if (!orgId || !planName) {
      this.logger.error('Checkout sem orgId ou planName no metadata')
      return
    }

    const plan = await this.prisma.plan.findUnique({ where: { name: planName } })
    if (!plan) {
      this.logger.error(`Plano ${planName} não encontrado`)
      return
    }

    const stripeSubscriptionId = session.subscription as string
    let stripeSubscription: Stripe.Subscription | null = null

    if (this.stripe && stripeSubscriptionId) {
      stripeSubscription = await this.stripe.subscriptions.retrieve(stripeSubscriptionId)
    }

    const periodStart = stripeSubscription?.current_period_start
      ? new Date(stripeSubscription.current_period_start * 1000)
      : new Date()
    const periodEnd = stripeSubscription?.current_period_end
      ? new Date(stripeSubscription.current_period_end * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const subscription = await this.prisma.subscription.upsert({
      where: { orgId },
      create: {
        orgId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId,
        stripeCheckoutSessionId: session.id,
        stripePriceId: stripeSubscription?.items?.data?.[0]?.price?.id,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        trialEndsAt: null,
      },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId,
        stripeCheckoutSessionId: session.id,
        stripePriceId: stripeSubscription?.items?.data?.[0]?.price?.id,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        canceledAt: null,
        trialEndsAt: null,
      },
    })

    await this.prisma.billingEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: BillingEventType.PAYMENT,
        amountCents: (session.amount_total ?? 0),
        status: BillingEventStatus.COMPLETED,
        externalId: session.id,
        stripeEventId: eventId,
        description: `Checkout completado — Plano ${planName}`,
        metadata: { sessionId: session.id, planName },
      },
    })

    this.logger.log(`Subscription ATIVADA para org ${orgId} — Plano ${planName}`)
  }

  private async handleSubscriptionUpdated(stripeSubscription: Stripe.Subscription, eventId: string) {
    const orgId = stripeSubscription.metadata?.orgId
    if (!orgId) return

    const planName = stripeSubscription.metadata?.planName as PlanName
    const plan = planName ? await this.prisma.plan.findUnique({ where: { name: planName } }) : null

    const status = this.mapStripeStatus(stripeSubscription.status)

    const subscription = await this.prisma.subscription.findUnique({ where: { orgId } })
    if (!subscription) return

    await this.prisma.subscription.update({
      where: { orgId },
      data: {
        status,
        ...(plan ? { planId: plan.id } : {}),
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        canceledAt: stripeSubscription.canceled_at
          ? new Date(stripeSubscription.canceled_at * 1000)
          : null,
      },
    })

    await this.prisma.billingEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: BillingEventType.CHARGE,
        amountCents: 0,
        status: BillingEventStatus.COMPLETED,
        stripeEventId: eventId,
        description: `Subscription atualizada — status: ${status}`,
        metadata: { stripeStatus: stripeSubscription.status },
      },
    })

    this.logger.log(`Subscription atualizada para org ${orgId} — status: ${status}`)
  }

  private async handleSubscriptionDeleted(stripeSubscription: Stripe.Subscription, eventId: string) {
    const orgId = stripeSubscription.metadata?.orgId
    if (!orgId) return

    const subscription = await this.prisma.subscription.findUnique({ where: { orgId } })
    if (!subscription) return

    await this.prisma.subscription.update({
      where: { orgId },
      data: {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
      },
    })

    await this.prisma.billingEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: BillingEventType.REFUND,
        amountCents: 0,
        status: BillingEventStatus.COMPLETED,
        stripeEventId: eventId,
        description: 'Subscription cancelada via Stripe',
        metadata: { reason: stripeSubscription.cancellation_details?.reason },
      },
    })

    this.logger.log(`Subscription CANCELADA para org ${orgId}`)
  }

  private async handlePaymentSucceeded(invoice: Stripe.Invoice, eventId: string) {
    const orgId = invoice.subscription_details?.metadata?.orgId
    if (!orgId) return

    const subscription = await this.prisma.subscription.findUnique({ where: { orgId } })
    if (!subscription) return

    await this.prisma.billingEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: BillingEventType.PAYMENT,
        amountCents: invoice.amount_paid ?? 0,
        status: BillingEventStatus.COMPLETED,
        externalId: invoice.id,
        stripeEventId: eventId,
        description: `Pagamento recebido — Invoice ${invoice.number}`,
        metadata: { invoiceId: invoice.id, invoiceNumber: invoice.number },
      },
    })

    // Garantir que subscription está ACTIVE
    await this.prisma.subscription.update({
      where: { orgId },
      data: { status: SubscriptionStatus.ACTIVE },
    })

    this.logger.log(`Pagamento confirmado para org ${orgId} — R$ ${(invoice.amount_paid ?? 0) / 100}`)
  }

  private async handlePaymentFailed(invoice: Stripe.Invoice, eventId: string) {
    const orgId = invoice.subscription_details?.metadata?.orgId
    if (!orgId) return

    const subscription = await this.prisma.subscription.findUnique({ where: { orgId } })
    if (!subscription) return

    await this.prisma.subscription.update({
      where: { orgId },
      data: { status: SubscriptionStatus.PAST_DUE },
    })

    await this.prisma.billingEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: BillingEventType.CHARGE,
        amountCents: invoice.amount_due ?? 0,
        status: BillingEventStatus.FAILED,
        externalId: invoice.id,
        stripeEventId: eventId,
        description: `Pagamento falhou — Invoice ${invoice.number}`,
        metadata: { invoiceId: invoice.id },
      },
    })

    this.logger.warn(`Pagamento FALHOU para org ${orgId}`)
  }

  // ─── Consultar Subscription ───────────────────────────────────────────────

  async getSubscription(orgId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { orgId },
      include: {
        plan: true,
        billingEvents: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!subscription) {
      return { status: 'NO_SUBSCRIPTION', plan: null, limits: PLAN_LIMITS['FREE'] }
    }

    const planName = subscription.plan.name
    return {
      ...subscription,
      limits: PLAN_LIMITS[planName] ?? PLAN_LIMITS['FREE'],
    }
  }

  // ─── Cancelar Subscription ────────────────────────────────────────────────

  async cancelSubscription(orgId: string) {
    const subscription = await this.prisma.subscription.findUnique({ where: { orgId } })
    if (!subscription) throw new NotFoundException('Nenhuma assinatura encontrada')

    if (subscription.stripeSubscriptionId && this.stripe) {
      await this.stripe.subscriptions.update(subscription.stripeSubscriptionId, {
        cancel_at_period_end: true,
      })
      this.logger.log(`Cancelamento agendado no Stripe para org ${orgId}`)
    }

    return this.prisma.subscription.update({
      where: { orgId },
      data: {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
      },
    })
  }

  // ─── Utilitários ──────────────────────────────────────────────────────────

  private mapStripeStatus(stripeStatus: string): SubscriptionStatus {
    const map: Record<string, SubscriptionStatus> = {
      active: SubscriptionStatus.ACTIVE,
      trialing: SubscriptionStatus.TRIALING,
      past_due: SubscriptionStatus.PAST_DUE,
      canceled: SubscriptionStatus.CANCELED,
      unpaid: SubscriptionStatus.PAST_DUE,
      incomplete: SubscriptionStatus.INACTIVE,
      incomplete_expired: SubscriptionStatus.INACTIVE,
      paused: SubscriptionStatus.INACTIVE,
    }
    return map[stripeStatus] ?? SubscriptionStatus.INACTIVE
  }

  private async simulateCheckoutSession(orgId: string, planName: PlanName) {
    this.logger.warn(`Modo simulado: checkout para org ${orgId}, plano ${planName}`)
    const plan = await this.prisma.plan.findUnique({ where: { name: planName } })
    if (!plan) throw new NotFoundException(`Plano ${planName} não encontrado`)

    const subscription = await this.prisma.subscription.upsert({
      where: { orgId },
      create: {
        orgId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      update: {
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        canceledAt: null,
      },
    })

    await this.prisma.billingEvent.create({
      data: {
        subscriptionId: subscription.id,
        type: BillingEventType.PAYMENT,
        amountCents: plan.priceCents,
        status: BillingEventStatus.COMPLETED,
        description: `[SIMULADO] Checkout completado — Plano ${planName}`,
      },
    })

    return {
      url: null,
      sessionId: `sim_${Date.now()}`,
      simulated: true,
      message: 'Stripe não configurado — subscription ativada em modo simulado',
    }
  }

  // ─── Obter limites do plano atual da org ──────────────────────────────────

  async getOrgPlanLimits(orgId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { orgId },
      include: { plan: true },
    })

    if (!subscription || subscription.status === SubscriptionStatus.CANCELED || subscription.status === SubscriptionStatus.INACTIVE) {
      return { planName: 'FREE', limits: PLAN_LIMITS['FREE'] }
    }

    const planName = subscription.plan.name
    return { planName, limits: PLAN_LIMITS[planName] ?? PLAN_LIMITS['FREE'] }
  }
}
