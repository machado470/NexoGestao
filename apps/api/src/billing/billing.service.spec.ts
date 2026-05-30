import { ServiceUnavailableException } from '@nestjs/common'
import { BillingService } from './billing.service'

describe('BillingService degraded mode', () => {
  it('retorna erro estruturado quando Stripe não está configurado', async () => {
    const prisma = {} as any
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'STRIPE_SECRET_KEY') return ''
        return ''
      }),
    } as any

    const quotas = {} as any

    const service = new BillingService(prisma, config, quotas)

    await expect(
      service.createCheckoutSession('org-1', 'PRO', 'http://localhost:3000/s', 'http://localhost:3000/c'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException)
  })

  it('falha rápido quando Stripe está ausente em produção', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production'
        if (key === 'STRIPE_SECRET_KEY') return ''
        if (key === 'BILLING_ENABLE_SIMULATED_CHECKOUT') return 'false'
        return ''
      }),
    } as any

    expect(() => new BillingService({} as any, config, {} as any)).toThrow(
      'STRIPE_SECRET_KEY/STRIPE_KEY é obrigatório em produção',
    )
  })

  it('bloqueia checkout simulado em produção', () => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production'
        if (key === 'STRIPE_SECRET_KEY') return 'sk_test_123'
        if (key === 'BILLING_ENABLE_SIMULATED_CHECKOUT') return 'true'
        return ''
      }),
    } as any

    expect(() => new BillingService({} as any, config, {} as any)).toThrow(
      'BILLING_ENABLE_SIMULATED_CHECKOUT não é permitido em produção',
    )
  })

})

describe('BillingService Stripe synchronization', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'STRIPE_WEBHOOK_SECRET') return 'whsec_test'
      if (key === 'STRIPE_PRICE_PRO') return 'price_pro_real'
      return ''
    }),
  } as any

  const currentSubscription = {
    id: 'sub-local',
    orgId: 'org-1',
    planId: 'plan-pro',
    billingProvider: 'STRIPE',
    billingCustomerRef: 'cus_1',
    billingExternalRef: 'sub_1',
    currentPeriodStart: new Date('2026-05-01T00:00:00.000Z'),
    currentPeriodEnd: new Date('2026-06-01T00:00:00.000Z'),
  }

  function makePrisma(overrides: Record<string, any> = {}) {
    const tx = {
      billingEvent: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'evt-local' }),
      },
      plan: { findUnique: jest.fn().mockResolvedValue({ id: 'plan-pro', priceCents: 9900 }) },
      subscription: {
        upsert: jest.fn().mockResolvedValue(currentSubscription),
        findFirst: jest.fn().mockResolvedValue(currentSubscription),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...currentSubscription, ...data })),
        findUnique: jest.fn().mockResolvedValue(currentSubscription),
      },
      ...overrides,
    }
    return {
      ...tx,
      $transaction: jest.fn((callback: any) => callback(tx)),
    } as any
  }

  function stripeEvent(type: string, object: Record<string, any>, id = `evt_${type}`) {
    return { id, type, data: { object } } as any
  }

  function makeService(prisma: any, event?: any) {
    const service = new BillingService(prisma, config, {} as any)
    ;(service as any).stripe = {
      webhooks: { constructEvent: jest.fn().mockReturnValue(event) },
      subscriptions: { cancel: jest.fn() },
    }
    return service
  }

  it('rejeita webhook com assinatura inválida', async () => {
    const prisma = makePrisma()
    const service = makeService(prisma)
    ;(service as any).stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('assinatura inválida')
    })

    await expect(service.handleWebhook(Buffer.from('{}'), 'invalid')).rejects.toThrow('assinatura inválida')
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it('processa checkout.session.completed criando ou ativando assinatura Stripe', async () => {
    const prisma = makePrisma()
    const event = stripeEvent('checkout.session.completed', {
      metadata: { orgId: 'org-1', planName: 'PRO' },
      subscription: 'sub_1',
      customer: 'cus_1',
    })
    const service = makeService(prisma, event)

    await expect(service.handleWebhook(Buffer.from('{}'), 'valid')).resolves.toEqual({ received: true, processed: true })
    expect(prisma.subscription.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { orgId: 'org-1' },
      create: expect.objectContaining({ billingExternalRef: 'sub_1', billingCustomerRef: 'cus_1', status: 'ACTIVE' }),
    }))
    expect(prisma.billingEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ providerEventId: event.id }) })
  })

  it.each([
    ['invoice.paid', 'ACTIVE', 'COMPLETED'],
    ['invoice.payment_failed', 'PAST_DUE', 'FAILED'],
  ])('processa %s sincronizando status local', async (type, status, eventStatus) => {
    const prisma = makePrisma()
    const event = stripeEvent(type, { subscription: 'sub_1', period_start: 1777593600, period_end: 1780272000, amount_paid: 9900, amount_due: 9900 })
    const service = makeService(prisma, event)

    await expect(service.handleWebhook(Buffer.from('{}'), 'valid')).resolves.toEqual({ received: true, processed: true })
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status }) }))
    expect(prisma.billingEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ status: eventStatus, providerEventId: event.id }) })
  })

  it.each([
    ['customer.subscription.updated', 'active', 'ACTIVE'],
    ['customer.subscription.deleted', 'canceled', 'CANCELED'],
  ])('processa %s sincronizando assinatura', async (type, stripeStatus, localStatus) => {
    const prisma = makePrisma()
    const event = stripeEvent(type, {
      id: 'sub_1', status: stripeStatus, customer: 'cus_1', canceled_at: 1780272000,
      current_period_start: 1777593600, current_period_end: 1780272000,
      items: { data: [{ price: { id: 'price_pro_real' } }] }, metadata: {},
    })
    const service = makeService(prisma, event)

    await expect(service.handleWebhook(Buffer.from('{}'), 'valid')).resolves.toEqual({ received: true, processed: true })
    expect(prisma.subscription.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: localStatus, planId: 'plan-pro' }) }))
    expect(prisma.billingEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ providerEventId: event.id, type: 'ADJUSTMENT' }) })
  })

  it('não processa novamente um webhook já registrado', async () => {
    const prisma = makePrisma()
    prisma.billingEvent.findUnique.mockResolvedValue({ id: 'already-processed' })
    const service = makeService(prisma, stripeEvent('invoice.paid', { subscription: 'sub_1' }, 'evt_duplicate'))

    await expect(service.handleWebhook(Buffer.from('{}'), 'valid')).resolves.toEqual({ received: true, processed: false })
    expect(prisma.subscription.update).not.toHaveBeenCalled()
    expect(prisma.billingEvent.create).not.toHaveBeenCalled()
  })

  it('cancela assinatura na Stripe antes de refletir cancelamento no banco', async () => {
    const prisma = makePrisma()
    const service = makeService(prisma)
    ;(service as any).stripe.subscriptions.cancel.mockResolvedValue({ canceled_at: 1780272000 })

    await service.cancelSubscription('org-1')

    expect((service as any).stripe.subscriptions.cancel).toHaveBeenCalledWith('sub_1')
    expect(prisma.subscription.update).toHaveBeenCalledWith({
      where: { orgId: 'org-1' },
      data: { status: 'CANCELED', canceledAt: new Date(1780272000 * 1000) },
    })
    expect(prisma.billingEvent.create).toHaveBeenCalledWith({ data: expect.objectContaining({ type: 'ADJUSTMENT', status: 'COMPLETED' }) })
  })

  it('não marca cancelamento local quando a Stripe falha', async () => {
    const prisma = makePrisma()
    const service = makeService(prisma)
    ;(service as any).stripe.subscriptions.cancel.mockRejectedValue(new Error('Stripe indisponível'))

    await expect(service.cancelSubscription('org-1')).rejects.toThrow('Stripe indisponível')
    expect(prisma.$transaction).not.toHaveBeenCalled()
    expect(prisma.subscription.update).not.toHaveBeenCalled()
  })
})
