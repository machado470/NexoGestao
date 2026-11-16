/** UTC instants delimiting a civil day in an IANA timezone, including DST midnight gaps. */
export function zonedDayBounds(now: Date, timeZone: string): { start: Date; end: Date } {
  if (!Number.isFinite(now.getTime())) throw new RangeError('Invalid reference date')
  if (typeof timeZone !== 'string' || !timeZone.trim()) throw new RangeError('Missing timezone')
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone, calendar: 'iso8601', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit',
  })
  const civilDate = (instant: number) => {
    const parts = formatter.formatToParts(new Date(instant))
    const part = (type: string) => Number(parts.find(value => value.type === type)!.value)
    return { year: part('year'), month: part('month'), day: part('day') }
  }
  const key = ({ year, month, day }: ReturnType<typeof civilDate>) => year * 10000 + month * 100 + day
  const current = civilDate(now.getTime())
  const nominal = new Date(0)
  nominal.setUTCFullYear(current.year, current.month - 1, current.day)
  const tomorrow = new Date(nominal)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const boundary = (dateKey: number, anchor: number) => {
    // Search civil dates rather than guessing a UTC offset or assuming 24-hour days.
    let lower = anchor - 48 * 60 * 60 * 1000
    let upper = anchor + 48 * 60 * 60 * 1000
    while (lower < upper) {
      const middle = lower + Math.floor((upper - lower) / 2)
      if (key(civilDate(middle)) < dateKey) lower = middle + 1
      else upper = middle
    }
    return new Date(lower)
  }
  return {
    start: boundary(key(current), nominal.getTime()),
    end: boundary(tomorrow.getUTCFullYear() * 10000 + (tomorrow.getUTCMonth() + 1) * 100 + tomorrow.getUTCDate(), tomorrow.getTime()),
  }
}
