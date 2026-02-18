type TimelineEvent = {
  id: string
  action?: string | null
  title?: string | null
  createdAt: string
  description?: string | null
  context?: string | null
  personName?: string | null
}

export default function EventTimeline({ events }: { events: TimelineEvent[] }) {
  if (!events || events.length === 0) {
    return <div className="text-sm opacity-60">Nenhum evento registrado.</div>
  }

  function humanizeAction(action: string) {
    return action
      .replaceAll('_', ' ')
      .toLowerCase()
      .replace(/^\w/, c => c.toUpperCase())
  }

  return (
    <div className="space-y-3">
      {events.map(e => {
        const message = e.description ?? e.context ?? null

        const label =
          (e.title && e.title.trim().length > 0 ? e.title : null) ??
          (e.action && e.action.trim().length > 0
            ? humanizeAction(e.action)
            : 'Evento')

        return (
          <div key={e.id} className="p-3 rounded-lg border border-white/10">
            <div className="flex items-center justify-between mb-1">
              <div className="font-semibold text-sm">{label}</div>

              <div className="text-xs opacity-60">
                {new Date(e.createdAt).toLocaleString()}
              </div>
            </div>

            {message && <div className="text-sm opacity-90">{message}</div>}

            {e.personName && (
              <div className="mt-1 text-xs opacity-60">{e.personName}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
