import { useEffect, useState } from 'react'
import { getExecutiveReport, getExecutiveMetrics } from '../../services/reports'
import type { ExecutiveReport } from '../../services/reports'

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [report, setReport] = useState<ExecutiveReport | null>(null)
  const [metrics, setMetrics] = useState<any>(null)

  useEffect(() => {
    Promise.all([getExecutiveReport(), getExecutiveMetrics(30)])
      .then(([r, m]) => {
        setReport(r)
        setMetrics(m)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="p-6">Carregando...</div>

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-semibold">Relatórios</h1>

      <div className="border rounded p-4">
        <div className="text-sm font-semibold mb-2">Executive Report</div>
        <pre className="text-xs overflow-auto">{JSON.stringify(report, null, 2)}</pre>
      </div>

      <div className="border rounded p-4">
        <div className="text-sm font-semibold mb-2">Métricas (SLA)</div>
        <pre className="text-xs overflow-auto">{JSON.stringify(metrics, null, 2)}</pre>
      </div>
    </div>
  )
}
