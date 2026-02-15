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
        description="Estado institucional consolidado"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <div className="text-xs opacity-60">Pessoas</div>
          <div className="text-2xl font-semibold">
            {data.people.total}
          </div>
        </Card>

        <Card>
          <div className="text-xs opacity-60">Risco institucional</div>
          <div className="text-2xl font-semibold">
            {data.risk.average}
          </div>
        </Card>

        <Card>
          <div className="text-xs opacity-60">Corretivas abertas</div>
          <div className="text-2xl font-semibold">
            {data.correctiveActions.open}
          </div>
        </Card>

        <Card>
          <div className="text-xs opacity-60">Restritos/Suspensos</div>
          <div className="text-2xl font-semibold">
            {data.people.restricted + data.people.suspended}
          </div>
        </Card>
      </div>

      {data.lastRun && (
        <Card>
          <div className="text-sm opacity-60 mb-2">
            Última execução de governança
          </div>

          <div className="text-sm space-y-1">
            <div>
              Score institucional: <strong>{data.lastRun.institutionalRiskScore}</strong>
            </div>
            <div>
              Avaliados: {data.lastRun.evaluated}
            </div>
            <div>
              Duração: {Math.round(data.lastRun.durationMs / 1000)}s
            </div>
            <div>
              Finalizado em:{' '}
              {new Date(data.lastRun.finishedAt).toLocaleString()}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
