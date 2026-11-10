/** UTC bounds of a civil month; do not assume a fixed offset or number of hours. */
export function zonedMonthBounds(timeZone: string, month?: string, now = new Date(Date.now())) {
  if (typeof timeZone !== 'string' || !timeZone.trim()) throw new RangeError('Missing timezone')
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, calendar: 'iso8601', numberingSystem: 'latn', year: 'numeric', month: '2-digit',
  })
  const civilMonth = (date: Date) => {
    const parts = formatter.formatToParts(date)
    const month = Number(parts.find(p => p.type === 'month')!.value)
    // A timezone can cross a year boundary relative to UTC. Using the signed
    // UTC year also handles year 0001 without locale-specific era formatting.
    const difference = month - (date.getUTCMonth() + 1)
    const year = date.getUTCFullYear() + (difference > 6 ? -1 : difference < -6 ? 1 : 0)
    return { year, month }
  }
  if (month !== undefined && (typeof month !== 'string' || !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month))) {
    throw new RangeError('Invalid month; use YYYY-MM')
  }
  const target = month === undefined ? civilMonth(now) : { year: Number(month.slice(0, 4)), month: Number(month.slice(5)) }
  const nominal = new Date(0)
  nominal.setUTCFullYear(target.year, target.month - 1, 1)
  const next = new Date(nominal)
  next.setUTCMonth(next.getUTCMonth() + 1)
  const boundary = (anchor: Date) => {
    const targetKey = anchor.getUTCFullYear() * 12 + anchor.getUTCMonth()
    let lower = anchor.getTime() - 48 * 60 * 60 * 1000
    let upper = anchor.getTime() + 48 * 60 * 60 * 1000
    while (lower < upper) {
      const middle = lower + Math.floor((upper - lower) / 2)
      const civil = civilMonth(new Date(middle))
      if (civil.year * 12 + civil.month - 1 < targetKey) lower = middle + 1
      else upper = middle
    }
    return new Date(lower)
  }
  return {
    month: `${String(target.year).padStart(4, '0')}-${String(target.month).padStart(2, '0')}`,
    start: boundary(nominal), end: boundary(next),
  }
}
