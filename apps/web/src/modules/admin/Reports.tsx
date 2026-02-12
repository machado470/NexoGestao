import { useEffect, useState } from 'react'

import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'

import {
  getExecutiveReport,
  type ExecutiveReport,
} from '../../services/reports'

export default function Reports() {
  const [loading, setLoading] = useState(true)
  const [data, setData] =
    useState<ExecutiveReport | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const report = await getExecutiveReport()
        setData(report)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="text-sm opacity-60">
        Carregando relatório…
      </div>
    )
  }

  if (!data) {
    return (
      <div className="text-sm opacity-60">
        Nenhum dado disponível.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatório Executivo"
        description="Indicadores consolidados de risco e ações."
      />

      <Card>
        <div className="text-sm space-y-1">
          <div>
            Pessoas OK: {data.peopleStats.OK}
          </div>
          <div>
            Pessoas em atenção:{' '}
            {data.peopleStats.WARNING}
          </div>
          <div>
            Pessoas críticas:{' '}
            {data.peopleStats.CRITICAL}
          </div>
          <div>
            Ações corretivas abertas:{' '}
            {data.correctiveOpenCount}
          </div>
        </div>
      </Card>
    </div>
  )
}
