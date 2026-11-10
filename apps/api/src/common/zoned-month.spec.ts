import { zonedMonthBounds } from './zoned-month'

describe('Civil month boundaries', () => {
  it.each([
    ['UTC', '0001-01', '0001-01-01T00:00:00.000Z', '0001-02-01T00:00:00.000Z'],
    ['UTC', '2024-02', '2024-02-01T00:00:00.000Z', '2024-03-01T00:00:00.000Z'],
    ['America/Sao_Paulo', '2018-11', '2018-11-01T03:00:00.000Z', '2018-12-01T02:00:00.000Z'],
    ['America/New_York', '2026-03', '2026-03-01T05:00:00.000Z', '2026-04-01T04:00:00.000Z'],
    ['Asia/Kathmandu', '2024-02', '2024-01-31T18:15:00.000Z', '2024-02-29T18:15:00.000Z'],
    ['Pacific/Kiritimati', '2026-12', '2026-11-30T10:00:00.000Z', '2026-12-31T10:00:00.000Z'],
    ['America/New_York', '2026-12', '2026-12-01T05:00:00.000Z', '2027-01-01T05:00:00.000Z'],
    ['Africa/Cairo', '2014-08', '2014-07-31T22:00:00.000Z', '2014-08-31T21:00:00.000Z'],
  ])('%s %s handles leap years, DST and offset boundaries', (zone, month, start, end) => {
    const range = zonedMonthBounds(zone, month)
    expect(range.month).toBe(month)
    expect(range.start.toISOString()).toBe(start)
    expect(range.end.toISOString()).toBe(end)
  })
  it('defaults to the civil month in a positive-offset zone', () => {
    expect(zonedMonthBounds('Pacific/Kiritimati', undefined, new Date('2026-11-30T12:00:00Z')).month).toBe('2026-12')
  })
  it.each(['UTC', 'America/Los_Angeles', 'Asia/Tokyo'])('does not use server timezone %s', serverZone => {
    const original = process.env.TZ
    try {
      process.env.TZ = serverZone
      expect(zonedMonthBounds('America/Sao_Paulo', '2026-11').start.toISOString()).toBe('2026-11-01T03:00:00.000Z')
    } finally {
      if (original === undefined) delete process.env.TZ
      else process.env.TZ = original
    }
  })
})
