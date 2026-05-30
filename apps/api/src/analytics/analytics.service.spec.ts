import { BadRequestException } from '@nestjs/common'
import { AnalyticsService } from './analytics.service'

describe('AnalyticsService passive assignee warning telemetry', () => {
  const create = jest.fn().mockResolvedValue({})
  const service = new AnalyticsService({ usageMetric: { create } } as any)

  beforeEach(() => create.mockClear())

  it('registra payload limitado pelo tenant autenticado sem aceitar orgId do client', async () => {
    await service.trackProductEvent({
      orgId: 'org-authenticated',
      userId: 'actor-1',
      eventName: 'ASSIGNEE_WARNING_CONFIRMED',
      metadata: {
        context: 'SERVICE_ORDER',
        personId: 'person-1',
        warningTypes: ['OVERLOADED'],
        entityId: 'os-1',
        orgId: 'org-from-client',
        arbitrary: 'discard-me',
      },
    })

    expect(create).toHaveBeenCalledWith({
      data: {
        orgId: 'org-authenticated',
        userId: 'actor-1',
        event: expect.anything(),
        metadata: {
          category: 'passive_assignee_warning',
          eventName: 'ASSIGNEE_WARNING_CONFIRMED',
          context: 'SERVICE_ORDER',
          personId: 'person-1',
          warningTypes: ['OVERLOADED'],
          entityId: 'os-1',
        },
      },
    })
  })

  it('rejeita eventName fora da allowlist', async () => {
    await expect(service.trackProductEvent({
      orgId: 'org-authenticated',
      userId: 'actor-1',
      eventName: 'NOT_ALLOWED',
    })).rejects.toBeInstanceOf(BadRequestException)
  })
})
