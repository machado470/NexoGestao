import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import {
  PlanName,
  SubscriptionStatus,
  BillingEventType,
  BillingEventStatus,
  BillingProvider,
  Prisma,
} from '@prisma/client'
import Stripe from 'stripe'
import { getDefaultPlanDefinition } from '../common/commercial/default-plan-definitions'
import { QuotasService } from '../quotas/quotas.service'

@Injectable()
export class BillingService {

  private readonly logger = new Logger(BillingService.name)
  private stripe: Stripe | null = null

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly quotasService: QuotasService,
  ) {

    const secretKey =
      this.config.get<string>('STRIPE_SECRET_KEY') ||
      this.config.get<string>('STRIPE_KEY') ||
      ''
    const isProduction =
      (this.config.get<string>('NODE_ENV') || process.env.NODE_ENV || '')
        .toLowerCase()
        .trim() === 'production'

    if (isProduction && this.isSimulatedCheckoutEnabled()) {
      throw new Error('[Billing] BILLING_ENABLE_SIMULATED_CHECKOUT não é permitido em produção')
    }

    if (!secretKey && isProduction) {
      throw new Error('[Billing] STRIPE_SECRET_KEY/STRIPE_KEY é obrigatório em produção')
    }

    if (secretKey) {
      this.stripe = new Stripe(secretKey, { apiVersion: '2024-06-20' })
      this.logger.log('[BOOT][Billing] Stripe inicializado')
    } else {
      this.logger.warn('[BOOT][Billing][disabled] Stripe não configurado — checkout online desabilitado')
    }

  }

  get isStripeConfigured(): boolean {
    return this.stripe !== null
  }

  private getPlanPriceMap(): Record<string, string> {
    const starter = this.config.get<string>('STRIPE_PRICE_STARTER')?.trim() ?? ''
    const pro = this.config.get<string>('STRIPE_PRICE_PRO')?.trim() ?? ''
    const business = this.config.get<string>('STRIPE_PRICE_BUSINESS')?.trim() ?? ''

    return {
      FREE: '',
      STARTER: starter,
      PRO: pro,
      BUSINESS: business,
    }
  }

  private normalizePlanName(planName: string): string {
    if (planName === 'SCALE') return 'BUSINESS'
    return planName
  }

  private isSimulatedCheckoutEnabled(): boolean {
    const value = (this.config.get<string>('BILLING_ENABLE_SIMULATED_CHECKOUT') ?? '')
      .trim()
      .toLowerCase()
    return value === '1' || value === 'true' || value === 'yes'
  }

  private assertStripeAvailable(operation: string) {
    if (this.stripe) return
    throw new ServiceUnavailableException({
      code: 'INTEGRATION_NOT_CONFIGURED',
      integration: 'stripe',
      operation,
      message:
        'Integração Stripe não configurada. Defina STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET para habilitar cobrança online.',
    })
  }

  private assertCheckoutRedirectUrl(url?: string, kind: 'successUrl' | 'cancelUrl' = 'successUrl') {
    if (!url) return

    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      throw new BadRequestException(`${kind} inválida`)
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new BadRequestException(`${kind} deve usar http(s)`)
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
    this.assertCheckoutRedirectUrl(successUrl, 'successUrl')
    this.assertCheckoutRedirectUrl(cancelUrl, 'cancelUrl')

    if (!this.stripe && this.isSimulatedCheckoutEnabled()) {
      return this.simulateCheckoutSession(orgId, planName)
    }
    this.assertStripeAvailable('create_checkout_session')

    const normalizedPlanName = this.normalizePlanName(planName)
    const priceId = this.getPlanPriceMap()[normalizedPlanName]

    if (!priceId) {
      throw new ServiceUnavailableException(
        `priceId do Stripe ausente para o plano ${planName}. Verifique STRIPE_PRICE_* no ambiente.`,
      )
    }

    const session = await this.stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl ?? 'http://localhost:5173/billing/success',
      cancel_url: cancelUrl ?? 'http://localhost:5173/billing/cancel',
      metadata: { orgId, planName: normalizedPlanName },
      subscription_data: { metadata: { orgId, planName: normalizedPlanName } },
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
    this.assertStripeAvailable('webhook')

    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET')

    if (!secret) {
      throw new ServiceUnavailableException(
        'STRIPE_WEBHOOK_SECRET não configurado',
      )
    }

    const event = this.stripe.webhooks.constructEvent(rawBody, signature, secret)
    this.logger.log(`Webhook recebido: ${event.type}`)

    const processed = await this.prisma.$transaction(async tx => {
      const duplicate = await tx.billingEvent.findUnique({
        where: { providerEventId: event.id },
      })
      if (duplicate) return false

      const object = event.data.object as any
      const checkout = event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded'
      const externalRef = event.type.startsWith('invoice.') ? this.stripeId(object.subscription) : this.stripeId(object.id)
      const orgId = checkout ? object.metadata?.orgId : (await tx.subscription.findFirst({ where: { billingExternalRef: externalRef ?? '__missing__' } }))?.orgId
      if (!orgId) return this.ignoreWebhook(event, 'sem assinatura local mapeada')
      // Reconcile under the tenant lock. Provider calls are bounded below, and
      // retries check idempotency again after acquiring cross-instance ownership.
      // NO KEY UPDATE serializes reconciliations without blocking FK key-share
      // locks used by ordinary customer/payment inserts in this organization.
      const rows = await tx.$queryRaw<Array<{id:string}>>`SELECT id FROM "Organization" WHERE id = ${orgId} FOR NO KEY UPDATE`
      if (!rows.length) throw new NotFoundException('Organização da assinatura não encontrada')
      if (await tx.billingEvent.findUnique({ where: { providerEventId: event.id } })) return false
      return this.processWebhookEvent(tx, event)
    }, { timeout: 15000, maxWait: 5000 })

    return { received: true, processed }
  }

  private async processWebhookEvent(tx: Prisma.TransactionClient, event: Stripe.Event) {
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        return this.processCheckoutCompleted(tx, event)
      case 'invoice.paid':
        return this.processInvoice(tx, event, BillingEventStatus.COMPLETED)
      case 'invoice.payment_failed':
        return this.processInvoice(tx, event, BillingEventStatus.FAILED)
      case 'customer.subscription.updated':
        return this.processStripeSubscription(tx, event)
      case 'customer.subscription.deleted':
        return this.processStripeSubscription(tx, event)
      default:
        this.logger.log(`Webhook ignorado: ${event.type}`)
        return false
    }
  }

  private async processCheckoutCompleted(
    tx: Prisma.TransactionClient,
    event: Stripe.CheckoutSessionCompletedEvent | Stripe.CheckoutSessionAsyncPaymentSucceededEvent,
  ) {
    const session = event.data.object
    const orgId = session.metadata?.orgId
    const planName = this.toPlanName(session.metadata?.planName)
    const externalRef = this.stripeId(session.subscription)

    if (!orgId || !planName || !externalRef) {
      throw new BadRequestException('checkout.session.completed sem metadata orgId/planName ou subscription id')
    }

    if (session.mode !== 'subscription') throw new BadRequestException('Checkout não é de assinatura')
    const current = await tx.subscription.findUnique({ where: { orgId } })
    const provider = await this.readProviderSubscription(externalRef)
    if (provider.metadata?.orgId && provider.metadata.orgId !== orgId) throw new ConflictException('Assinatura do provedor pertence a outra organização')
    const eventAt = this.eventDate(event)
    if (current?.billingExternalRef && current.billingExternalRef !== externalRef &&
        (provider.status === 'canceled' || (current.billingProviderEventAt && eventAt <= current.billingProviderEventAt))) {
      await this.createProviderEvent(tx, current.id, event, BillingEventType.ADJUSTMENT, BillingEventStatus.COMPLETED, 0, 'Checkout antigo ignorado; associação atual preservada')
      return false
    }
    const eligible = provider.status === 'active' || provider.status === 'trialing'
    if (!eligible && current?.billingExternalRef && current.billingExternalRef !== externalRef) {
      await this.createProviderEvent(tx, current.id, event, BillingEventType.ADJUSTMENT, BillingEventStatus.PENDING, 0, 'Novo checkout pendente; assinatura existente preservada')
      return false
    }
    // Pending checkout must not grant paid quotas through legacy readers that
    // still derive resource limits from planId independently of status.
    const authoritativePlan = eligible ? this.planFromStripeSubscription(provider) ?? planName : PlanName.FREE
    const plan = !eligible && current ? null : await tx.plan.findUnique({ where: { name: authoritativePlan } })
    if (!plan && !current) throw new NotFoundException(`Plano ${authoritativePlan} não encontrado`)
    if (eligible && !plan) throw new NotFoundException(`Plano ${authoritativePlan} não encontrado`)
    const data = { planId: plan?.id ?? current!.planId, ...this.providerState(provider), billingProviderEventAt: this.latestEventDate(current?.billingProviderEventAt, eventAt) }
    const subscription = await tx.subscription.upsert({ where: { orgId }, create: { orgId, ...data }, update: data })
    // Checkout is evidence of setup, not a second invoice/payment ledger entry.
    await this.createProviderEvent(tx, subscription.id, event, BillingEventType.ADJUSTMENT, BillingEventStatus.COMPLETED, 0, 'Stripe checkout reconciliado com assinatura atual')
    return true
  }

  private async processInvoice(
    tx: Prisma.TransactionClient,
    event: Stripe.InvoicePaidEvent | Stripe.InvoicePaymentFailedEvent,
    eventStatus: BillingEventStatus,
  ) {
    const invoice = event.data.object
    const externalRef = this.stripeId(invoice.subscription)
    if (!externalRef) return this.ignoreWebhook(event, 'invoice sem subscription id')

    const current = await tx.subscription.findFirst({ where: { billingExternalRef: externalRef } })
    if (!current) return this.ignoreWebhook(event, `assinatura ${externalRef} não encontrada`)

    const provider = await this.readProviderSubscription(externalRef)
    const planName = this.planFromStripeSubscription(provider)
    const plan = (provider.status === 'active' || provider.status === 'trialing') && planName ? await tx.plan.findUnique({ where: { name: planName } }) : null
    const subscription = await tx.subscription.update({ where: { id: current.id }, data: {
      ...this.providerState(provider), planId: plan?.id ?? current.planId, billingProviderEventAt: this.latestEventDate(current.billingProviderEventAt, this.eventDate(event)),
    } })
    const amount = event.type === 'invoice.paid' ? invoice.amount_paid : invoice.amount_due
    await this.createProviderEvent(tx, subscription.id, event, BillingEventType.PAYMENT, eventStatus, amount, `Stripe ${event.type}`)
    return true
  }

  private async processStripeSubscription(
    tx: Prisma.TransactionClient,
    event: Stripe.CustomerSubscriptionUpdatedEvent | Stripe.CustomerSubscriptionDeletedEvent,
  ) {
    const stripeSubscription = event.data.object
    const current = await tx.subscription.findFirst({ where: { billingExternalRef: stripeSubscription.id } })
    if (!current) return this.ignoreWebhook(event, `assinatura ${stripeSubscription.id} não encontrada`)

    const provider = await this.readProviderSubscription(stripeSubscription.id)
    const planName = this.planFromStripeSubscription(provider)
    const plan = (provider.status === 'active' || provider.status === 'trialing') && planName ? await tx.plan.findUnique({ where: { name: planName } }) : null
    const subscription = await tx.subscription.update({ where: { id: current.id }, data: {
      ...this.providerState(provider), planId: plan?.id ?? current.planId,
      billingProviderEventAt: this.latestEventDate(current.billingProviderEventAt, this.eventDate(event)),
    } })

    await this.createProviderEvent(tx, subscription.id, event, BillingEventType.ADJUSTMENT, BillingEventStatus.COMPLETED, 0, `Stripe ${event.type}`)
    return true
  }

  private async readProviderSubscription(id: string) {
    const subscription = await this.stripe!.subscriptions.retrieve(id, {}, { timeout: 5000, maxNetworkRetries: 0 })
    if (subscription.id !== id) throw new ConflictException('Referência de assinatura divergente')
    return subscription
  }

  private providerState(subscription: Stripe.Subscription) {
    const start = this.fromUnix(subscription.current_period_start), end = this.fromUnix(subscription.current_period_end)
    const customer = this.stripeId(subscription.customer)
    if (!start || !end || end <= start || !customer) throw new BadRequestException('Assinatura do provedor sem período ou cliente válido')
    return { status: this.fromStripeSubscriptionStatus(subscription.status), billingProvider: BillingProvider.STRIPE,
      billingCustomerRef: customer, billingExternalRef: subscription.id, currentPeriodStart: start, currentPeriodEnd: end,
      canceledAt: subscription.status === 'canceled' ? this.fromUnix(subscription.canceled_at) ?? new Date() : null }
  }

  private eventDate(event: Stripe.Event) {
    if (!Number.isSafeInteger(event.created) || event.created <= 0) throw new BadRequestException('Evento Stripe sem data válida')
    return new Date(event.created * 1000)
  }

  private latestEventDate(current: Date | null | undefined, incoming: Date) {
    return current && current > incoming ? current : incoming
  }

  private async createProviderEvent(
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    event: Stripe.Event,
    type: BillingEventType,
    status: BillingEventStatus,
    amountCents: number,
    description: string,
  ) {
    await tx.billingEvent.create({
      data: { subscriptionId, providerEventId: event.id, type, status, amountCents, description },
    })
  }

  private ignoreWebhook(event: Stripe.Event, reason: string) {
    this.logger.warn(`Webhook ${event.type} ignorado: ${reason}`)
    return false
  }

  private stripeId(value: string | { id: string } | null | undefined) {
    return typeof value === 'string' ? value : value?.id
  }

  private fromUnix(value?: number | null) {
    return value ? new Date(value * 1000) : undefined
  }

  private toPlanName(value?: string | null): PlanName | undefined {
    const normalized = value === 'SCALE' ? 'BUSINESS' : value
    return normalized && ['FREE', 'STARTER', 'PRO', 'BUSINESS'].includes(normalized)
      ? normalized as PlanName
      : undefined
  }

  private planFromStripeSubscription(subscription: Stripe.Subscription) {
    const priceId = subscription.items.data[0]?.price.id
    const entry = Object.entries(this.getPlanPriceMap()).find(([, configuredPrice]) => configuredPrice && configuredPrice === priceId)
    return this.toPlanName(entry?.[0] ?? subscription.metadata?.planName)
  }

  private fromStripeSubscriptionStatus(status: Stripe.Subscription.Status) {
    if (status === 'active') return SubscriptionStatus.ACTIVE
    if (status === 'trialing') return SubscriptionStatus.TRIALING
    if (status === 'past_due' || status === 'unpaid') return SubscriptionStatus.PAST_DUE
    if (status === 'canceled') return SubscriptionStatus.CANCELED
    return SubscriptionStatus.SUSPENDED
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
        limits: this.quotasService.getQuotaLimits('FREE'),
      }
    }

    const planName = this.normalizePlanName(subscription.plan.name)

    return {
      ...subscription,
      limits: this.quotasService.getQuotaLimits(planName),
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
    const subscription = await this.prisma.subscription.findUnique({ where: { orgId } })
    if (!subscription) throw new NotFoundException('Nenhuma assinatura encontrada')

    if (subscription.billingProvider === BillingProvider.STRIPE) {
      if (!subscription.billingExternalRef) {
        throw new ServiceUnavailableException('Assinatura Stripe sem billingExternalRef; cancelamento local bloqueado')
      }
      this.assertStripeAvailable('cancel_subscription')

      const canceled = await this.stripe.subscriptions.cancel(subscription.billingExternalRef)
      const canceledAt = this.fromUnix(canceled.canceled_at) ?? new Date()
      return this.prisma.$transaction(async tx => {
        const updated = await tx.subscription.update({
          where: { orgId },
          data: { status: SubscriptionStatus.CANCELED, canceledAt },
        })
        await tx.billingEvent.create({
          data: {
            subscriptionId: subscription.id,
            type: BillingEventType.ADJUSTMENT,
            amountCents: 0,
            status: BillingEventStatus.COMPLETED,
            description: 'Stripe subscription cancelada imediatamente',
          },
        })
        return updated
      })
    }

    return this.prisma.$transaction(async tx => {
      const updated = await tx.subscription.update({
        where: { orgId },
        data: { status: SubscriptionStatus.CANCELED, canceledAt: new Date() },
      })
      await tx.billingEvent.create({
        data: {
          subscriptionId: subscription.id,
          type: BillingEventType.ADJUSTMENT,
          amountCents: 0,
          status: BillingEventStatus.COMPLETED,
          description: '[SIMULADO] cancelamento local',
        },
      })
      return updated
    })
  }

  /*
  ========================================
  SIMULATED CHECKOUT
  ========================================
  */

  async simulateCheckoutSession(orgId: string, planName: PlanName) {

    const isProduction =
      (this.config.get<string>('NODE_ENV') || process.env.NODE_ENV || '')
        .toLowerCase()
        .trim() === 'production'
    if (isProduction) {
      throw new ServiceUnavailableException('Checkout simulado não é permitido em produção')
    }

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

  async getPlanCatalog() {
    const plans = await this.prisma.plan.findMany()

    const planOrder: Record<string, number> = {
      FREE: 0,
      STARTER: 1,
      PRO: 2,
      BUSINESS: 3,
    }

    return plans
      .filter(plan => plan.name in planOrder)
      .sort((a, b) => planOrder[a.name] - planOrder[b.name])
      .map(plan => ({
        name: plan.name,
        displayName: plan.displayName,
        priceCents: plan.priceCents,
        billingInterval: getDefaultPlanDefinition(plan.name).billingInterval,
        quotas: this.quotasService.getQuotaLimits(plan.name),
        commercialLimits: plan.limitsJson,
        features: plan.featuresJson,
      }))
  }

  async getBillingLimits(orgId: string) {
    return this.quotasService.getQuotaUsage(orgId)
  }

}
