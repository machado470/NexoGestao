import { useExecutiveDashboard } from '../../hooks/useExecutiveDashboard'

function Card({ title, children }: { title: string; children: any }) {
  return (
    <div className="border rounded p-4">
      <div className="text-sm opacity-70">{title}</div>
      <div className="text-xl font-semibold">{children}</div>
    </div>
  )
}

export default function AdminDashboard() {
  const { loading, peopleStats, correctiveOpenCount, people } = useExecutiveDashboard()

  if (loading) {
    return <div className="p-6">Carregando...</div>
  }

  const total = (peopleStats.OK ?? 0) + (peopleStats.WARNING ?? 0) + (peopleStats.CRITICAL ?? 0)
  const atRisk = (peopleStats.WARNING ?? 0) + (peopleStats.CRITICAL ?? 0)

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Executive Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card title="Total">{total}</Card>
        <Card title="OK">{peopleStats.OK ?? 0}</Card>
        <Card title="Em risco">{atRisk}</Card>
        <Card title="Corretivas abertas">{correctiveOpenCount}</Card>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-2">Pessoas</h2>
        <div className="space-y-2">
          {people.map(p => (
            <div key={p.id} className="border rounded p-3 flex justify-between">
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm opacity-70">{p.reason ?? '—'}</div>
              </div>
              <div className="text-sm font-medium">
                {p.status} ({p.riskScore})
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
