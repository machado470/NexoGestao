import { previewAppointmentSeries } from './appointment-series-preview'

describe('appointment series preview', () => {
  it('maintains the local time across a daylight saving offset change', () => {
    const visits = previewAppointmentSeries(
      new Date('2026-03-01T14:00:00Z'), new Date('2026-03-01T14:45:00Z'),
      'America/New_York', 'WEEKLY', 3,
    )
    expect(visits.map(visit => [visit.startsAt.toISOString(), visit.endsAt.toISOString()])).toEqual([
      ['2026-03-01T14:00:00.000Z', '2026-03-01T14:45:00.000Z'],
      ['2026-03-08T13:00:00.000Z', '2026-03-08T13:45:00.000Z'],
      ['2026-03-15T13:00:00.000Z', '2026-03-15T13:45:00.000Z'],
    ])
  })

  it('rejects nonexistent and ambiguous local times', () => {
    expect(() => previewAppointmentSeries(
      new Date('2026-03-01T07:30:00Z'), new Date('2026-03-01T08:00:00Z'),
      'America/New_York', 'WEEKLY', 2,
    )).toThrow(/visita 2/)
    expect(() => previewAppointmentSeries(
      new Date('2026-10-25T05:30:00Z'), new Date('2026-10-25T06:00:00Z'),
      'America/New_York', 'WEEKLY', 2,
    )).toThrow(/visita 2/)
  })

  it('generates visits every fourteen calendar days for a fortnightly series', () => {
    const visits = previewAppointmentSeries(
      new Date('2026-11-28T12:00:00Z'), new Date('2026-11-28T13:00:00Z'),
      'America/Sao_Paulo', 'BIWEEKLY', 2,
    )
    expect(visits[1].startsAt.toISOString()).toBe('2026-12-12T12:00:00.000Z')
  })
})
