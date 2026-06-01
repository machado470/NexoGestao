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
  describe('getAssigneeWarningSummary', () => {
    const metric = (
      orgId: string,
      eventName: 'ASSIGNEE_WARNING_SHOWN' | 'ASSIGNEE_WARNING_CONFIRMED',
      context: 'APPOINTMENT' | 'SERVICE_ORDER',
      personId: string,
      warningTypes: string[],
    ) => ({
      orgId,
      createdAt: new Date('2026-05-15T12:00:00.000Z'),
      metadata: { category: 'passive_assignee_warning', eventName, context, personId, warningTypes },
    })

    it('resume somente o tenant autenticado com taxas, contextos, tipos, combinações e nomes', async () => {
      const metrics = [
        metric('org-authenticated', 'ASSIGNEE_WARNING_SHOWN', 'APPOINTMENT', 'person-1', ['OVERLOADED', 'UNAVAILABLE_NOW']),
        metric('org-authenticated', 'ASSIGNEE_WARNING_SHOWN', 'SERVICE_ORDER', 'person-1', ['UNAVAILABLE_NOW', 'OVERLOADED']),
        metric('org-authenticated', 'ASSIGNEE_WARNING_CONFIRMED', 'SERVICE_ORDER', 'person-1', ['OVERLOADED', 'UNAVAILABLE_NOW']),
        metric('org-authenticated', 'ASSIGNEE_WARNING_SHOWN', 'SERVICE_ORDER', 'person-2', ['OVER_CAPACITY']),
        metric('org-other', 'ASSIGNEE_WARNING_SHOWN', 'APPOINTMENT', 'person-other', ['OVERLOADED']),
        metric('org-other', 'ASSIGNEE_WARNING_CONFIRMED', 'APPOINTMENT', 'person-other', ['OVERLOADED']),
      ]
      const usageMetricFindMany = jest.fn(({ where }: any) => metrics
        .filter((entry) => entry.orgId === where.orgId && entry.createdAt >= where.createdAt.gte && entry.createdAt <= where.createdAt.lte)
        .map(({ metadata }) => ({ metadata })))
      const personFindMany = jest.fn().mockResolvedValue([{ id: 'person-1', name: 'Ana' }])
      const summaryService = new AnalyticsService({
        usageMetric: { findMany: usageMetricFindMany },
        person: { findMany: personFindMany },
      } as any)

      const summary = await summaryService.getAssigneeWarningSummary(
        'org-authenticated',
        new Date('2026-05-01T00:00:00.000Z'),
        new Date('2026-05-30T00:00:00.000Z'),
      )

      expect(usageMetricFindMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          orgId: 'org-authenticated',
          OR: [
            { metadata: { path: ['eventName'], equals: 'ASSIGNEE_WARNING_SHOWN' } },
            { metadata: { path: ['eventName'], equals: 'ASSIGNEE_WARNING_CONFIRMED' } },
          ],
        }),
      }))
      expect(personFindMany).toHaveBeenCalledWith({
        where: { orgId: 'org-authenticated', id: { in: ['person-1', 'person-2'] } },
        select: { id: true, name: true },
      })
      expect(summary.totals).toEqual({ shown: 3, confirmed: 1, confirmationRatePct: 33.3 })
      expect(summary.byContext).toEqual([
        { context: 'APPOINTMENT', shown: 1, confirmed: 0, confirmationRatePct: 0 },
        { context: 'SERVICE_ORDER', shown: 2, confirmed: 1, confirmationRatePct: 50 },
      ])
      expect(summary.byWarningType).toEqual([
        { warningType: 'UNAVAILABLE_NOW', shown: 2, confirmed: 1 },
        { warningType: 'UNAVAILABLE_SOON', shown: 0, confirmed: 0 },
        { warningType: 'OVER_CAPACITY', shown: 1, confirmed: 0 },
        { warningType: 'OVERLOADED', shown: 2, confirmed: 1 },
      ])
      expect(summary.commonCombinations).toEqual([
        { warningTypes: ['OVERLOADED', 'UNAVAILABLE_NOW'], shown: 2, confirmed: 1 },
        { warningTypes: ['OVER_CAPACITY'], shown: 1, confirmed: 0 },
      ])
      expect(summary.topPeople).toEqual([
        { personId: 'person-1', name: 'Ana', shown: 2, confirmed: 1 },
        { personId: 'person-2', name: null, shown: 1, confirmed: 0 },
      ])
    })

    it('rejeita datas inválidas e intervalo invertido', async () => {
      const summaryService = new AnalyticsService({ usageMetric: { findMany: jest.fn() } } as any)

      await expect(summaryService.getAssigneeWarningSummary(
        'org-authenticated',
        new Date('invalid'),
      )).rejects.toBeInstanceOf(BadRequestException)
      await expect(summaryService.getAssigneeWarningSummary(
        'org-authenticated',
        new Date('2026-05-30T00:00:00.000Z'),
        new Date('2026-05-01T00:00:00.000Z'),
      )).rejects.toBeInstanceOf(BadRequestException)
    })

    it('retorna taxa nula quando não existem alertas exibidos', async () => {
      const usageMetricFindMany = jest.fn().mockResolvedValue([])
      const personFindMany = jest.fn()
      const summaryService = new AnalyticsService({
        usageMetric: { findMany: usageMetricFindMany },
        person: { findMany: personFindMany },
      } as any)

      const summary = await summaryService.getAssigneeWarningSummary('org-authenticated')

      expect(summary.totals).toEqual({ shown: 0, confirmed: 0, confirmationRatePct: null })
      expect(summary.byContext.every((context) => context.confirmationRatePct === null)).toBe(true)
      expect(personFindMany).not.toHaveBeenCalled()
      expect(new Date(summary.period.to).getTime() - new Date(summary.period.from).getTime()).toBe(30 * 24 * 60 * 60 * 1000)
    })
  })

})
