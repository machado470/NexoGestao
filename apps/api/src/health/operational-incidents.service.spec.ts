import { OperationalIncidentsService } from './operational-incidents.service'

describe('OperationalIncidentsService', () => {
  it('classifica incidentes por severidade a partir de degradedReasons/DLQ/fila', async () => {
    const svc = new OperationalIncidentsService({
      summary: jest.fn().mockResolvedValue({
        degradedReasons: ['queue_service_not_bound'],
        queues: [{ queue: 'webhooks', failed: 2, waiting: 0, active: 0, completed: 0, delayed: 0, degraded: true, degradedReasons: ['failed_jobs_present'] }],
        dlq: [{ queue: 'webhooks-dlq', backlog: 12, failed: 3, lastFailureAt: null }],
        metrics: { retries: 4 },
      }),
    } as any)

    const incidents = await svc.list()
    expect(incidents.some((i) => i.severity === 'WARNING' && i.code === 'HEALTH_DEGRADED_REASON')).toBe(true)
    expect(incidents.some((i) => i.severity === 'CRITICAL' && i.code === 'QUEUE_DEGRADED')).toBe(true)
    expect(incidents.some((i) => i.severity === 'CRITICAL' && i.code === 'DLQ_BACKLOG')).toBe(true)
    expect(incidents.some((i) => i.severity === 'INFO' && i.code === 'RETRY_ACTIVITY')).toBe(true)
  })
})
