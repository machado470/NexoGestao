import Card from '../base/Card'
import StatusBadge from '../base/StatusBadge'

type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'

type Props = {
  riskByLevel: Record<RiskLevel, number>
}

const LEVEL_LABEL: Record<RiskLevel, string> = {
  LOW: 'Baixo',
  MEDIUM: 'Médio',
  HIGH: 'Alto',
  CRITICAL: 'Crítico',
}

export default function RiskOverview({ riskByLevel }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {(Object.keys(riskByLevel) as RiskLevel[]).map(level => (
        <Card key={level}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">
                Risco {LEVEL_LABEL[level]}
              </p>
              <p className="text-3xl font-semibold mt-2">
                {riskByLevel[level]}
              </p>
            </div>

            <StatusBadge label={LEVEL_LABEL[level]} tone={level} />
          </div>
        </Card>
      ))}
    </div>
  )
}
