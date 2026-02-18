import { useExecutiveDashboard } from '../../hooks/useExecutiveDashboard'
import type { PersonStatus } from '../../hooks/useExecutiveDashboard'

export default function PeoplePage() {
  const { loading, people } = useExecutiveDashboard()

  if (loading) {
    return <div className="p-6">Carregando...</div>
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">
        Pessoas
      </h1>

      <div className="space-y-3">
        {people.map(p => (
          <div
            key={p.id}
            className="border rounded p-4 flex justify-between"
          >
            <div>
              <div className="font-medium">
                {p.name}
              </div>
              <div className="text-sm opacity-70">
                {p.department ?? '—'}
              </div>
            </div>

            <StatusBadge status={p.status} />
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: PersonStatus }) {
  const color =
    status === 'CRITICAL'
      ? 'text-red-600'
      : status === 'WARNING'
      ? 'text-yellow-600'
      : status === 'RESTRICTED'
      ? 'text-orange-600'
      : status === 'SUSPENDED'
      ? 'text-red-800'
      : 'text-green-600'

  return (
    <span className={`text-sm font-semibold ${color}`}>
      {status}
    </span>
  )
}
