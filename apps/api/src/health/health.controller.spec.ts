import { HealthController } from './health.controller'

describe('HealthController operational hardening', () => {
  it('marca /health como degraded quando queue service não está bindado', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) } as any
    const metrics = { snapshot: jest.fn().mockReturnValue({}) } as any
    const tenantOps = { snapshot: jest.fn().mockReturnValue({}) } as any
    const commercial = { getAdminTenantCommercialOverview: jest.fn().mockResolvedValue({ ok: true }) } as any
    const config = { get: jest.fn().mockReturnValue('') } as any

    const controller = new HealthController(prisma, metrics, tenantOps, commercial, config, undefined)

    const result = await controller.health()

    expect(result.status).toBe('degraded')
    expect(result.checks.queue.ok).toBe(false)
    expect(result.checks.queue.summary).toEqual(expect.objectContaining({ reason: 'queue_service_not_bound' }))
    expect(result.degradedReasons).toContain('queue_service_not_bound')
  })
})
