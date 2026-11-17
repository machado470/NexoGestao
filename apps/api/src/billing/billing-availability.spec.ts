import { BillingService } from './billing.service'
import Stripe from 'stripe'
jest.mock('stripe', () => jest.fn())
describe('billing availability for authenticated frontend', () => {
  const setup = (overrides = {}, provider: string | null = 'STRIPE') => {
    const values = { NODE_ENV: 'production', STRIPE_ENABLED: 'false', ...overrides }
    const prisma = { subscription: { findUnique: jest.fn().mockResolvedValue(provider ? { billingProvider: provider } : null) } }
    const service = new BillingService(prisma as any, { get: key => values[key] } as any, {} as any)
    return { service, prisma }
  }
  beforeEach(() => jest.clearAllMocks())
  it('does not expose checkout or Stripe cancellation while explicitly disabled', async () => {
    const { service, prisma } = setup({ STRIPE_SECRET_KEY: 'stale', STRIPE_PRICE_PRO: 'price_stale' })
    expect(await service.getAvailability('authenticated-org')).toEqual({ status: 'disabled', checkoutPlans: [], cancellationAvailable: false })
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({ where: { orgId: 'authenticated-org' }, select: { billingProvider: true } })
    expect(Stripe).not.toHaveBeenCalled()
  })
  it('preserves cancellation of local subscriptions without requiring Stripe', async () => {
    expect((await setup({}, 'MANUAL').service.getAvailability('org')).cancellationAvailable).toBe(true)
  })
  it('offers only plans configured in the enabled provider, without exposing secrets or price IDs', async () => {
    const { service } = setup({ STRIPE_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_not_for_network', STRIPE_PRICE_PRO: 'price_pro' })
    expect(await service.getAvailability('org')).toEqual({ status: 'available', checkoutPlans: ['PRO'], cancellationAvailable: true })
  })
  it('does not offer checkout without plan configuration or cancellation without a subscription', async () => {
    const { service } = setup({ STRIPE_ENABLED: 'true', STRIPE_SECRET_KEY: 'sk_test_not_for_network' }, null)
    expect(await service.getAvailability('org')).toEqual({ status: 'unavailable', checkoutPlans: [], cancellationAvailable: false })
  })
  it('keeps development simulation explicit', async () => {
    const { service } = setup({ NODE_ENV: 'development', STRIPE_ENABLED: 'true', BILLING_ENABLE_SIMULATED_CHECKOUT: 'true' }, null)
    expect(await service.getAvailability('org')).toEqual({ status: 'simulation', checkoutPlans: ['STARTER', 'PRO', 'BUSINESS'], cancellationAvailable: false })
  })
})
