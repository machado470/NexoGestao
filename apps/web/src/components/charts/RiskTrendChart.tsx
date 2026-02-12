import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { useTheme } from '../../theme/useTheme'

type DataPoint = {
  label: string
  critical: number
  high: number
  medium: number
}

type Props = {
  data?: DataPoint[]
}

export default function RiskTrendChart({ data }: Props) {
  const { styles } = useTheme()

  if (!data || data.length === 0) {
    return (
      <div className="h-48 w-full flex items-center justify-center text-sm opacity-60">
        Sem dados históricos suficientes para exibir tendência
      </div>
    )
  }

  return (
    <div className="h-48 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <XAxis
            dataKey="label"
            stroke="currentColor"
            opacity={0.4}
          />
          <YAxis stroke="currentColor" opacity={0.3} />
          <Tooltip
            contentStyle={{
              background: 'rgba(15,42,68,0.95)',
              borderRadius: 8,
              border: `1px solid ${styles.border}`,
              color: '#fff',
            }}
          />
          <Legend />

          <Line
            name="Crítico"
            type="monotone"
            dataKey="critical"
            stroke={styles.chart.danger}
            strokeWidth={2}
            dot={false}
          />
          <Line
            name="Alto"
            type="monotone"
            dataKey="high"
            stroke={styles.chart.warning}
            strokeWidth={2}
            dot={false}
          />
          <Line
            name="Médio"
            type="monotone"
            dataKey="medium"
            stroke={styles.chart.primary}
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
