import { Injectable, Module } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { WhatsAppMetricsModule } from './whatsapp-metrics.module'
import { WhatsAppObservabilityService } from './whatsapp-observability.service'

@Injectable()
class MessageConsumer {
  constructor(readonly metrics: WhatsAppObservabilityService) {}
}

@Injectable()
class HealthConsumer {
  constructor(readonly metrics: WhatsAppObservabilityService) {}
}

@Module({
  imports: [WhatsAppMetricsModule],
  providers: [MessageConsumer],
})
class MessageConsumerModule {}

@Module({
  imports: [WhatsAppMetricsModule],
  providers: [HealthConsumer],
})
class HealthConsumerModule {}

describe('Shared WhatsApp observability', () => {
  it('exposes the same counters to message processing and health consumers', async () => {
    const module = await Test.createTestingModule({
      imports: [MessageConsumerModule, HealthConsumerModule],
    }).compile()

    try {
      const messages = module.get(MessageConsumer)
      const health = module.get(HealthConsumer)

      messages.metrics.incInbound()
      messages.metrics.incFailedWebhook()

      expect(health.metrics).toBe(messages.metrics)
      expect(health.metrics.snapshot()).toMatchObject({
        whatsapp_inbound_total: 1,
        whatsapp_failed_webhook_total: 1,
      })
    } finally {
      await module.close()
    }
  })
})
