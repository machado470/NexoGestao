import { zonedDayBounds } from './zoned-day'

describe('IANA civil day boundaries', () => {
  it.each([
    ['America/Sao_Paulo', '2026-11-10T01:30:00Z', '2026-11-09T03:00:00Z', '2026-11-10T03:00:00Z'],
    ['UTC', '2026-11-10T01:30:00Z', '2026-11-10T00:00:00Z', '2026-11-11T00:00:00Z'],
    ['Pacific/Kiritimati', '2026-11-09T10:01:00Z', '2026-11-09T10:00:00Z', '2026-11-10T10:00:00Z'],
    ['Pacific/Pago_Pago', '2026-11-09T01:00:00Z', '2026-11-08T11:00:00Z', '2026-11-09T11:00:00Z'],
    ['Asia/Kathmandu', '2026-11-09T12:00:00Z', '2026-11-08T18:15:00Z', '2026-11-09T18:15:00Z'],
    ['America/New_York', '2026-03-08T12:00:00Z', '2026-03-08T05:00:00Z', '2026-03-09T04:00:00Z'],
    ['America/New_York', '2026-11-01T12:00:00Z', '2026-11-01T04:00:00Z', '2026-11-02T05:00:00Z'],
    ['America/Sao_Paulo', '2018-11-04T12:00:00Z', '2018-11-04T03:00:00Z', '2018-11-05T02:00:00Z'],
    ['Australia/Lord_Howe', '2026-10-04T01:00:00Z', '2026-10-03T13:30:00Z', '2026-10-04T13:00:00Z'],
    ['Pacific/Apia', '2011-12-30T09:00:00Z', '2011-12-29T10:00:00Z', '2011-12-30T10:00:00Z'],
    ['America/Sao_Paulo', '2027-01-01T01:00:00Z', '2026-12-31T03:00:00Z', '2027-01-01T03:00:00Z'],
  ])('bounds %s at %s including offset/DST/calendar transitions', (zone, input, start, end) => {
    const result = zonedDayBounds(new Date(input), zone)
    expect(result).toEqual({ start: new Date(start), end: new Date(end) })
    expect(new Date(input).getTime()).toBeGreaterThanOrEqual(result.start.getTime())
    expect(new Date(input).getTime()).toBeLessThan(result.end.getTime())
  })
  it('does not depend on the server timezone', () => {
    const previous = process.env.TZ
    try {
      process.env.TZ = 'Pacific/Auckland'
      const first = zonedDayBounds(new Date('2026-11-10T01:30Z'), 'America/Sao_Paulo')
      process.env.TZ = 'America/Los_Angeles'
      expect(zonedDayBounds(new Date('2026-11-10T01:30Z'), 'America/Sao_Paulo')).toEqual(first)
    } finally {
      if (previous === undefined) delete process.env.TZ
      else process.env.TZ = previous
    }
  })
  it.each(['', 'Mars/Olympus'])('rejects an invalid configured zone %p', zone => {
    expect(() => zonedDayBounds(new Date(), zone)).toThrow(RangeError)
  })
  it('rejects an invalid reference instant', () => {
    expect(() => zonedDayBounds(new Date(NaN), 'UTC')).toThrow(RangeError)
  })
})
