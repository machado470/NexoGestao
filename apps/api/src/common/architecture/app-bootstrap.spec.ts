import { Test } from '@nestjs/testing'
import { AppModule } from '../../app.module'
import { WhatsAppService } from '../../whatsapp/whatsapp.service'
import { OperationalMonitoringService } from '../../health/operational-monitoring.service'
import { WhatsAppObservabilityService } from '../metrics/whatsapp-observability.service'

describe('Application module dependency graph', () => {
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
