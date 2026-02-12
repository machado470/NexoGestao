import type { AuditEvent } from '../../services/timeline'

type Props = {
  events: AuditEvent[]
}

function actionTone(action: string) {
  if (action.includes('CRITICAL')) {
    return 'border-rose-500/40 text-rose-400'
  }

  if (action.includes('WARNING')) {
    return 'border-amber-500/40 text-amber-400'
  }

  if (
    action.includes('CREATED') ||
    action.includes('STARTED')
  ) {
    return 'border-blue-500/40 text-blue-400'
  }

  if (
    action.includes('COMPLETED') ||
    action.includes('RESOLVED')
  ) {
    return 'border-emerald-500/40 text-emerald-400'
  }

  return 'border-white/20 text-slate-300'
}

function humanizeAction(action: string) {
  return action
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^\w/, c => c.toUpperCase())
}

export default function EventTimeline({
  events,
}: Props) {
  if (!events || events.length === 0) {
    return (
      <div className="text-sm text-slate-400">
        Nenhum evento registrado.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {events.map(e => (
        <div
          key={e.id}
          className={`
            rounded-xl
            border
            px-4 py-3
            ${actionTone(e.action)}
          `}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold text-sm">
              {humanizeAction(e.action)}
            </div>

            <div className="text-xs opacity-60">
              {new Date(e.createdAt).toLocaleString()}
            </div>
          </div>

          {e.context && (
            <div className="text-sm opacity-90">
              {e.context}
            </div>
          )}

          {e.personName && (
            <div className="mt-1 text-xs opacity-60">
              {e.personName}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
