import { Test, TestingModule } from '@nestjs/testing'
import { ConfigService } from '@nestjs/config'
import { BillingService } from '../../billing/billing.service'
import { PaymentsService } from '../../payments/payments.service'
import { AppModule } from '../../app.module'
import { WhatsAppService } from '../../whatsapp/whatsapp.service'
import { OperationalMonitoringService } from '../../health/operational-monitoring.service'
import { WhatsAppObservabilityService } from '../metrics/whatsapp-observability.service'

describe('Application module dependency graph', () => {
  it('compiles production without optional provider credentials when Stripe and WhatsApp are explicitly disabled', async () => {
    const keys = ['NODE_ENV', 'WHATSAPP_PROVIDER', 'STRIPE_ENABLED', 'STRIPE_SECRET_KEY', 'STRIPE_KEY',
      'STRIPE_WEBHOOK_SECRET', 'BILLING_ENABLE_SIMULATED_CHECKOUT', 'RESEND_API_KEY',
      'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_SECRET', 'GOOGLE_REDIRECT_URL', 'GOOGLE_REDIRECT_URI']
    const previous = new Map(keys.map(key => [key, process.env[key]]))
    let module: TestingModule | undefined
    try {
      for (const key of keys) delete process.env[key]
      process.env.NODE_ENV = 'production'
      process.env.WHATSAPP_PROVIDER = 'disabled'
      process.env.STRIPE_ENABLED = 'false'
      module = await Test.createTestingModule({ imports: [AppModule] }).compile()
      expect(module.get(ConfigService).get('NODE_ENV')).toBe('production')
      expect(module.get(BillingService).isStripeConfigured).toBe(false)
      expect(module.get(PaymentsService)).toBeDefined()
      expect(module.get(WhatsAppService)).toBeDefined()
    } finally {
      await module?.close()
      for (const [key, value] of previous) {
        if (value === undefined) delete process.env[key]
        else process.env[key] = value
      }
    }
  })

  it('compiles the complete application and shares WhatsApp metrics with health monitoring', async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile()
    try {
      const metrics = module.get(WhatsAppObservabilityService)
      expect((module.get(WhatsAppService) as any).waMetrics).toBe(metrics)
      expect((module.get(OperationalMonitoringService) as any).waMetrics).toBe(metrics)
    } finally {
      await module.close()
    }
  })
})
