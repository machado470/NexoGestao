import { TenantOperationsService } from './tenant-operations.service'

describe('TenantOperationsService', () => {
  const prisma = {
    whatsAppMessage: { count: jest.fn() },
    webhookEndpoint: { count: jest.fn() },
    webhookDelivery: { groupBy: jest.fn() },
    subscription: { findUnique: jest.fn() },
    organizationExecutionConfig: { findUnique: jest.fn() },
  }
  const dashboard = { getExecutivePipeline: jest.fn() }
  const service = new TenantOperationsService(prisma as any, dashboard as any)

  beforeEach(() => {
    jest.resetAllMocks()
    dashboard.getExecutivePipeline.mockImplementation(async (orgId: string) => ({
      generatedAt: '2026-09-13T12:00:00.000Z',
      stages: [
        { key: 'customers', volume: orgId === 'org-a' ? 2 : 7, referenceTimestamp: null },
        { key: 'appointments', volume: 1, referenceTimestamp: null },
        { key: 'service-orders', volume: 3, referenceTimestamp: null },
        { key: 'charges', volume: 4, referenceTimestamp: null },
        { key: 'payments', volume: 5, referenceTimestamp: null },
      ],
    }))
    prisma.whatsAppMessage.count.mockImplementation(async ({ where }: any) => where.orgId === 'org-a' ? 11 : 22)
    prisma.webhookEndpoint.count.mockImplementation(async ({ where }: any) => where.orgId === 'org-a' ? (where.active ? 1 : 2) : 0)
    prisma.webhookDelivery.groupBy.mockImplementation(async ({ where }: any) => where.endpoint.orgId === 'org-a' ? [
      { status: 'PENDING', _count: { _all: 3 } }, { status: 'FAILED', _count: { _all: 4 } },
    ] : [])
    prisma.subscription.findUnique.mockImplementation(async ({ where }: any) => where.orgId === 'org-a' ? { status: 'ACTIVE' } : null)
    prisma.organizationExecutionConfig.findUnique.mockImplementation(async ({ where }: any) => where.orgId === 'org-a' ? { mode: 'manual', updatedAt: new Date('2026-09-13T10:00:00Z') } : null)
  })

  it('filters every source with the authenticated tenant and keeps A/B facts distinct', async () => {
    const [a, b] = await Promise.all([service.getSummary('org-a'), service.getSummary('org-b')])
    expect(a.facts[0].facts).toMatchObject({ customersVolume: 2 })
    expect(b.facts[0].facts).toMatchObject({ customersVolume: 7 })
    expect(a.facts.find(f => f.key === 'whatsapp')?.facts).toEqual({ failedMessages: 11 })
    expect(b.facts.find(f => f.key === 'whatsapp')?.facts).toEqual({ failedMessages: 22 })
    expect(dashboard.getExecutivePipeline).toHaveBeenCalledWith('org-a')
    expect(dashboard.getExecutivePipeline).toHaveBeenCalledWith('org-b')
    expect(prisma.webhookDelivery.groupBy).toHaveBeenCalledWith(expect.objectContaining({ where: { endpoint: { orgId: 'org-a' } } }))
    expect(JSON.stringify(a)).not.toContain('org-b')
    expect(JSON.stringify(b)).not.toContain('org-a')
  })

  it('preserves not_configured and unknown instead of manufacturing availability', async () => {
    const result = await service.getSummary('org-b')
    expect(result.facts.find(f => f.key === 'whatsapp')).toMatchObject({ status: 'unknown', reasonCode: 'TENANT_CONFIGURATION_NOT_OBSERVABLE' })
    expect(result.facts.find(f => f.key === 'webhooks')).toMatchObject({ status: 'not_configured' })
    expect(result.facts.find(f => f.key === 'billing')).toMatchObject({ status: 'not_configured', facts: { subscriptionStatus: null } })
    expect(result.facts.find(f => f.key === 'operation_config')).toMatchObject({ status: 'not_configured' })
  })

  it('turns an unclassified tenant source exception into unknown with null data', async () => {
    dashboard.getExecutivePipeline.mockRejectedValueOnce(new Error('database unavailable'))
    prisma.whatsAppMessage.count.mockRejectedValueOnce(new Error('database unavailable'))
    const result = await service.getSummary('org-a')
    expect(result.facts.find(f => f.key === 'resources')).toMatchObject({ status: 'unknown', reasonCode: 'TENANT_SOURCE_READ_FAILED', facts: { customersVolume: null } })
    expect(result.facts.find(f => f.key === 'whatsapp')).toMatchObject({ status: 'unknown', facts: { failedMessages: null } })
  })

  it('selects no secrets, payloads, global provider configuration, queues or infrastructure health', async () => {
    await service.getSummary('org-a')
    expect(prisma.subscription.findUnique).toHaveBeenCalledWith({ where: { orgId: 'org-a' }, select: { status: true } })
    expect(prisma.organizationExecutionConfig.findUnique).toHaveBeenCalledWith({ where: { orgId: 'org-a' }, select: { mode: true, updatedAt: true } })
    const serialized = JSON.stringify(await service.getSummary('org-a'))
    expect(serialized).not.toMatch(/secret|payload|dsn|queueNames|providerEnv|providerConfig|orgId/i)
  })
})
