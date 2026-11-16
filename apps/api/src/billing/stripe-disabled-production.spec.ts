import Stripe from 'stripe'
import { BillingService } from './billing.service'
import { PaymentsService } from '../payments/payments.service'
import { isStripeDisabled } from '../common/config/stripe-integration'

jest.mock('stripe', () => jest.fn())

describe('Explicitly disabled Stripe integration', () => {
  function config(overrides: Record<string, unknown> = {}) {
    const values = { NODE_ENV: 'production', STRIPE_ENABLED: 'false', ...overrides }
    return { get: jest.fn((key: string) => values[key]) } as any
  }

  beforeEach(() => jest.clearAllMocks())

  it.each(['false', ' FALSE ', false])('recognizes explicit disabling: %s', value => {
    expect(isStripeDisabled(config({ STRIPE_ENABLED: value }))).toBe(true)
  })

  it.each([undefined, '', 'true', '0', 'typo'])('retains required production credentials otherwise: %s', value => {
    const settings = config({ STRIPE_ENABLED: value })
    expect(isStripeDisabled(settings)).toBe(false)
    expect(() => new BillingService({} as any, settings, {} as any)).toThrow('obrigatório em produção')
    expect(() => new PaymentsService(settings, {} as any, {} as any)).toThrow('obrigatório em produção')
  })

  it.each(['STRIPE_SECRET_KEY', 'STRIPE_KEY'])('does not initialize SDK even with a stale %s', key => {
    const settings = config({ [key]: 'sk_test_stale_not_for_network' })
    const billing = new BillingService({} as any, settings, {} as any)
    new PaymentsService(settings, {} as any, {} as any)
    expect(billing.isStripeConfigured).toBe(false)
    expect(Stripe).not.toHaveBeenCalled()
  })

  it('rejects checkout, webhooks and simulation before changing financial records', async () => {
    const prisma = {
      $transaction: jest.fn(), charge: { findFirst: jest.fn() },
      plan: { findUnique: jest.fn() }, subscription: { upsert: jest.fn() },
    }
    const finance = { payChargeWithIdempotency: jest.fn() }
    const settings = config()
    const billing = new BillingService(prisma as any, settings, {} as any)
    const payments = new PaymentsService(settings, prisma as any, finance as any)
    const error = { status: 503, response: { code: 'INTEGRATION_DISABLED', integration: 'stripe' } }
    await expect(billing.createCheckoutSession('org', 'PRO')).rejects.toMatchObject(error)
    await expect(billing.handleWebhook(Buffer.from('{}'), 'signature')).rejects.toMatchObject(error)
    await expect(billing.simulateCheckoutSession('org', 'PRO')).rejects.toMatchObject(error)
    await expect(payments.createCheckoutSession({} as any)).rejects.toMatchObject(error)
    await expect(payments.handleWebhook(Buffer.from('{}'), 'signature')).rejects.toMatchObject(error)
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.charge.findFirst).not.toHaveBeenCalled()
    expect(prisma.plan.findUnique).not.toHaveBeenCalled()
    expect(prisma.subscription.upsert).not.toHaveBeenCalled()
    expect(finance.payChargeWithIdempotency).not.toHaveBeenCalled()
    expect(Stripe).not.toHaveBeenCalled()
  })

  it('does not cancel a persisted Stripe subscription locally', async () => {
    const prisma = {
      subscription: { findUnique: jest.fn().mockResolvedValue({ billingProvider: 'STRIPE', billingExternalRef: 'sub_existing' }), update: jest.fn() },
      $transaction: jest.fn(),
    }
    const billing = new BillingService(prisma as any, config(), {} as any)
    await expect(billing.cancelSubscription('org')).rejects.toMatchObject({ status: 503 })
    expect(prisma.subscription.update).not.toHaveBeenCalled()
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('continues to forbid simulated checkout in production', () => {
    expect(() => new BillingService({} as any, config({ BILLING_ENABLE_SIMULATED_CHECKOUT: 'true' }), {} as any))
      .toThrow('BILLING_ENABLE_SIMULATED_CHECKOUT não é permitido em produção')
  })

  it('explicit disabling also prevents development simulation from granting a plan', async () => {
    const prisma = { plan: { findUnique: jest.fn() }, subscription: { upsert: jest.fn() } }
    const billing = new BillingService(prisma as any, config({ NODE_ENV: 'development', BILLING_ENABLE_SIMULATED_CHECKOUT: 'true' }), {} as any)
    await expect(billing.createCheckoutSession('org', 'PRO')).rejects.toMatchObject({ status: 503 })
    await expect(billing.simulateCheckoutSession('org', 'PRO')).rejects.toMatchObject({ status: 503 })
    expect(prisma.plan.findUnique).not.toHaveBeenCalled()
    expect(prisma.subscription.upsert).not.toHaveBeenCalled()
  })
})
