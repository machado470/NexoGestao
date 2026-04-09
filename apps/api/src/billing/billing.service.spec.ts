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
})
