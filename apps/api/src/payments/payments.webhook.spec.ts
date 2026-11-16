import Stripe from 'stripe'
import { PaymentsService } from './payments.service'

describe('Signed Stripe operational payment events', () => {
  const secret = 'whsec_local_test_only'
  let service: PaymentsService, db: any, finance: any
  const session = (extra: object = {}) => ({ id: 'cs_test', object: 'checkout.session', mode: 'payment', payment_status: 'paid', amount_total: 1000, currency: 'brl', payment_intent: 'pi_test', metadata: { orgId: 'org', chargeId: 'charge' }, ...extra })
  const send = (object: any, type = 'checkout.session.completed') => {
    const payload = JSON.stringify({ id: 'evt_test', object: 'event', type, data: { object } })
    const signature = Stripe.webhooks.generateTestHeaderString({ payload, secret })
    return service.handleWebhook(Buffer.from(payload), signature)
  }
  beforeEach(() => {
    db = { charge: { findFirst: jest.fn().mockResolvedValue({ id: 'charge', orgId: 'org', amountCents: 1000, currency: 'BRL', status: 'PENDING' }) } }
    finance = { payCharge: jest.fn().mockResolvedValue({ ok: true }) }
    service = new PaymentsService({ get: (key: string) => key === 'STRIPE_SECRET_KEY' ? 'sk_test_local' : key === 'STRIPE_WEBHOOK_SECRET' ? secret : 'test' } as any, db, finance)
  })
  it('passes the received amount, currency and canonical intent to the transactional payment service', async () => {
    await send(session())
    expect(finance.payCharge).toHaveBeenCalledWith({ orgId: 'org', chargeId: 'charge', actorUserId: null, method: 'CARD', amountCents: 1000, currency: 'brl', externalRef: 'stripe:pi_test', idempotencyKey: 'stripe-payment:pi_test' })
  })
  it.each([{ amount_total: 100 }, { amount_total: 10000 }, { currency: 'usd' }])('rejects value/currency mismatch %p', async extra => {
    await expect(send(session(extra))).rejects.toThrow('Conciliação necessária')
    expect(finance.payCharge).not.toHaveBeenCalled()
  })
  it.each(['unpaid', 'no_payment_required'])('does not settle checkout state %s', async payment_status => {
    await expect(send(session({ payment_status }))).resolves.toEqual({ received: true })
    expect(finance.payCharge).not.toHaveBeenCalled()
  })
  it('uses the same key for a checkout, its charge event and an asynchronous success', async () => {
    await send(session())
    await send({ ...session(), object: 'charge', id: 'ch_test', paid: true, captured: true, amount_captured: 1000 }, 'charge.succeeded')
    await send(session(), 'checkout.session.async_payment_succeeded')
    expect(finance.payCharge).toHaveBeenCalledTimes(3)
    for (const [input] of finance.payCharge.mock.calls) expect(input.idempotencyKey).toBe('stripe-payment:pi_test')
  })
  it('does not settle an uncaptured card authorization', async () => {
    await send({ ...session(), paid: true, captured: false, amount_captured: 0 }, 'charge.succeeded')
    expect(finance.payCharge).not.toHaveBeenCalled()
  })
  it('rejects a tampered signature before querying the database', async () => {
    await expect(service.handleWebhook(Buffer.from('{}'), 'invalid')).rejects.toThrow()
    expect(db.charge.findFirst).not.toHaveBeenCalled()
  })
  it('ignores signed events without an operational tenant mapping', async () => {
    await send(session({ metadata: {}, payment_intent: null }))
    expect(finance.payCharge).not.toHaveBeenCalled()
  })
  it('copies the tenant mapping into PaymentIntent metadata when creating checkout', async () => {
    const create = jest.spyOn((service as any).stripe.checkout.sessions, 'create').mockResolvedValue({ id: 'cs_test', url: 'https://checkout.stripe.com/test' })
    await service.createCheckoutSession({ orgId: 'org', chargeId: 'charge', customerId: 'customer', amount: 1000, description: 'Service', successUrl: 'https://example.test/success', cancelUrl: 'https://example.test/cancel' })
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ payment_intent_data: { metadata: { orgId: 'org', chargeId: 'charge', customerId: 'customer' } } }))
  })
})
