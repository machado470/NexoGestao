import {
  normalizeTimelineEventType,
  timelineEventFilterValues,
} from './timeline-events'

describe('timeline event taxonomy', () => {
  it.each([
    ['APPOINTMENT_CANCELED', 'APPOINTMENT_CANCELLED'],
    ['EXECUTION_DONE', 'SERVICE_ORDER_COMPLETED'],
    ['SERVICE_ORDER_CHARGE_CREATED', 'CHARGE_CREATED'],
    ['CUSTOMER_OPERATIONAL_RISK_UPDATED', 'RISK_UPDATED'],
    ['OPERATIONAL_STATE_ENFORCED', 'OPERATIONAL_STATE_CHANGED'],
  ])('normalizes %s to %s', (legacy, canonical) => {
    expect(normalizeTimelineEventType(legacy)).toBe(canonical)
  })

  it('returns unknown events unchanged', () => {
    expect(normalizeTimelineEventType('FUTURE_EVENT_CREATED')).toBe(
      'FUTURE_EVENT_CREATED',
    )
  })

  it('expands canonical filters with known legacy aliases', () => {
    expect(timelineEventFilterValues('SERVICE_ORDER_COMPLETED')).toEqual(
      expect.arrayContaining([
        'SERVICE_ORDER_COMPLETED',
        'EXECUTION_DONE',
        'SERVICE_ORDER_DONE',
      ]),
    )
  })
})
