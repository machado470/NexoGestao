import { Link } from 'react-router-dom'
import { useExecutiveDashboard } from '../../hooks/useExecutiveDashboard'

export default function PeoplePage() {
  const { loading, people } = useExecutiveDashboard()

  if (loading) return <div className="p-6">Carregando...</div>

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Pessoas</h1>
        <Link to="/admin/pessoas/nova" className="border rounded px-3 py-2 text-sm">
          Nova pessoa
        </Link>
      </div>

      <div className="space-y-2">
        {people.map(p => (
          <Link
            key={p.id}
            to={`/admin/pessoas/${p.id}`}
            className="block border rounded p-3 hover:bg-black/5"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-medium truncate">{p.name}</div>
                <div className="text-sm opacity-70 truncate">{p.reason ?? '—'}</div>
              </div>
              <div className="text-sm font-semibold whitespace-nowrap">
                {p.status} ({p.riskScore})
              </div>
            </div>
          </Link>
        ))}

        {people.length === 0 && (
          <div className="border rounded p-4 opacity-70">Nenhuma pessoa encontrada.</div>
        )}
      </div>
    </div>
  )
}
