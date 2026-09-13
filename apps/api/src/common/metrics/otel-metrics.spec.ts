const add = jest.fn()
const record = jest.fn()
const addCallback = jest.fn()
const createCounter = jest.fn(() => ({ add }))
const createHistogram = jest.fn(() => ({ record }))
const createObservableGauge = jest.fn(() => ({ addCallback }))

jest.mock('@opentelemetry/api', () => ({
  metrics: { getMeter: () => ({ createCounter, createHistogram, createObservableGauge }) },
}))

import { MetricsService } from './metrics.service'
import { QueueObservabilityService } from './queue-observability.service'
import { WhatsAppObservabilityService } from './whatsapp-observability.service'

describe('custom OTEL metrics cardinality contract', () => {
  beforeEach(() => jest.clearAllMocks())

  it('exports an existing domain increment with controlled operation/status labels', () => {
    const service = new MetricsService()
    service.increment('executionActionStatus:failed')
    expect(add).toHaveBeenCalledWith(1, { operation: 'execution_action', status: 'failed' })
  })

  it('does not export endpoint strings or tenant/user identifiers', () => {
    const service = new MetricsService()
    service.incrementRequestByEndpoint('GET /customers/customer-arbitrary-value')
    service.incrementErrorByEndpoint('GET /orgs/org-arbitrary-value')
    service.observeEndpointLatency('GET /users/user-arbitrary-value', 42)
    expect(add).not.toHaveBeenCalled()
  })

  it('only exports allowlisted queue names and fixed event dimensions', () => {
    const service = new QueueObservabilityService()
    service.increment('queue.job.enqueue.success.whatsapp')
    service.increment('queue.job.enqueue.success.org-123-unbounded')
    expect(add).toHaveBeenCalledTimes(1)
    expect(add).toHaveBeenCalledWith(1, { operation: 'job_enqueue_success', status: 'recorded', queue: 'whatsapp' })
  })

  it('exports WhatsApp status as a closed label rather than an identifier', () => {
    const service = new WhatsAppObservabilityService()
    service.incInboundWebhookFailed()
    expect(add).toHaveBeenCalledWith(1, { operation: 'inbound_webhook', status: 'failed' })
  })
})
