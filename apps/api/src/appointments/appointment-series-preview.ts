import { BadRequestException } from '@nestjs/common'

/** Expand weekly visits by local calendar days, preserving the initial wall time. */
export function previewAppointmentSeries(
  startsAt: Date,
  endsAt: Date,
  timeZone: string,
  cadence: 'WEEKLY' | 'BIWEEKLY',
  count: number,
) {
  const duration = endsAt.getTime() - startsAt.getTime()
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isInteger(count) || count < 2 || count > 12) {
    throw new BadRequestException('Informe um período válido e entre 2 e 12 visitas.')
  }
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
  })
  const localStamp = (instant: number) => {
    const parts = Object.fromEntries(formatter.formatToParts(instant).map(part => [part.type, Number(part.value)]))
    const date = new Date(0)
    date.setUTCFullYear(parts.year, parts.month - 1, parts.day)
    date.setUTCHours(parts.hour, parts.minute, parts.second, new Date(instant).getUTCMilliseconds())
    return date.getTime()
  }
  const initial = startsAt.getTime()
  const wallStart = localStamp(initial)
  const dayMs = 86_400_000
  const step = (cadence === 'WEEKLY' ? 7 : 14) * dayMs

  return Array.from({ length: count }, (_, index) => {
    if (index === 0) return { startsAt, endsAt }

    const intended = wallStart + step * index
    const offsets = new Set([-dayMs, 0, dayMs].map(delta => {
      const instant = intended + delta
      return localStamp(instant) - instant
    }))
    const candidates = [...offsets]
      .map(offset => intended - offset)
      .filter(instant => localStamp(instant) === intended)
    if (candidates.length !== 1) {
      throw new BadRequestException(`A visita ${index + 1} cai em um horário ambíguo ou indisponível no fuso da empresa.`)
    }
    const start = candidates[0]
    return { startsAt: new Date(start), endsAt: new Date(start + duration) }
  })
}
