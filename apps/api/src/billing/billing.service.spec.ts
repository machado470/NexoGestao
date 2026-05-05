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
