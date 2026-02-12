import Card from '../../components/base/Card'
import PageHeader from '../../components/base/PageHeader'
import { useExecutiveDashboard } from '../../hooks/useExecutiveDashboard'

export default function ExecutiveDashboard() {
  const { data, loading } = useExecutiveDashboard()

  if (loading || !data) {
    return (
      <div className="text-sm opacity-60">
        Carregando dashboard executivo…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Visão Executiva"
        description="Estado operacional consolidado"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="text-xs opacity-60">
            Pessoas
          </div>
          <div className="text-2xl font-semibold">
            {data.people.total}
          </div>
        </Card>

        <Card>
          <div className="text-xs opacity-60">
            Risco médio
          </div>
          <div className="text-2xl font-semibold">
            {data.risk.average}
          </div>
        </Card>

        <Card>
          <div className="text-xs opacity-60">
            Ações corretivas abertas
          </div>
          <div className="text-2xl font-semibold">
            {data.correctiveActions.open}
          </div>
        </Card>

        <Card>
          <div className="text-xs opacity-60">
            Pessoas restritas/suspensas
          </div>
          <div className="text-2xl font-semibold">
            {data.people.restricted +
              data.people.suspended}
          </div>
        </Card>
      </div>
    </div>
  )
}
