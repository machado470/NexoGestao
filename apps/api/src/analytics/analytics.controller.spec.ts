import { BadRequestException } from '@nestjs/common'
import { AnalyticsController } from './analytics.controller'

describe('AnalyticsController assignee warning summary period', () => {
  const getAssigneeWarningSummary = jest.fn()
  const controller = new AnalyticsController({ getAssigneeWarningSummary } as any)

  beforeEach(() => getAssigneeWarningSummary.mockReset())

  it('aceita período opcional em ISO rigoroso e usa o tenant autenticado', () => {
    controller.getAssigneeWarningSummary(
      'org-authenticated',
      '2026-05-01T00:00:00.000Z',
      '2026-05-30T03:00:00-03:00',
    )

    expect(getAssigneeWarningSummary).toHaveBeenCalledWith(
      'org-authenticated',
      new Date('2026-05-01T00:00:00.000Z'),
      new Date('2026-05-30T03:00:00-03:00'),
    )
  })

  it.each([
    '2026-05-01',
    '05/01/2026',
    '2026-02-30T00:00:00.000Z',
    '2026-05-01T25:00:00.000Z',
    '2026-05-01T00:00:00+24:00',
  ])('rejeita data inválida ou ISO não rigoroso: %s', (from) => {
    expect(() => controller.getAssigneeWarningSummary('org-authenticated', from)).toThrow(BadRequestException)
    expect(getAssigneeWarningSummary).not.toHaveBeenCalled()
  })
})
