import { MetricsService } from './metrics.service'
import { RequestLoggerMiddleware } from '../middleware/request-logger.middleware'

describe('bounded HTTP metrics', () => {
  it('bounds request/error/latency dimensions together', () => {
    const metrics = new MetricsService()
    for (let i = 0; i < 2000; i++) {
      const endpoint = `GET /arbitrary-${i}`
      metrics.incrementRequestByEndpoint(endpoint)
      metrics.incrementErrorByEndpoint(endpoint)
      metrics.observeEndpointLatency(endpoint, 1)
    }
    const snapshot = metrics.snapshot()
    expect(Object.keys(snapshot.requestsByEndpoint)).toHaveLength(501)
    expect(Object.keys(snapshot.endpointLatency)).toHaveLength(501)
    expect(snapshot.requestsByEndpoint['OTHER /:overflow']).toBe(1500)
  })
  it('groups unmatched requests instead of retaining arbitrary URL paths', () => {
    const metrics = new MetricsService()
    const middleware = new RequestLoggerMiddleware(metrics)
    const log = jest.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      for (let i = 0; i < 1000; i++) {
        const req: any = { method: 'GET', originalUrl: `/unknown-${i}`, headers: {}, get: () => '', ip: 'test' }
        const res: any = { statusCode: 404, setHeader: () => {}, get: () => '', on: (_: string, finish: () => void) => finish() }
        middleware.use(req, res, () => {})
      }
      expect(metrics.snapshot().requestsByEndpoint).toEqual({ 'GET /:unmatched': 1000 })
    } finally { log.mockRestore() }
  })
})
