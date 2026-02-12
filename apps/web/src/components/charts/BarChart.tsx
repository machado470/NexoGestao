import { useTheme } from '../../theme/useTheme'

type Bar = {
  label: string
  value: number
}

type Props = {
  title?: string
  bars: Bar[]
}

export function BarChart({ title, bars }: Props) {
  const { styles } = useTheme()

  if (!bars || bars.length === 0) {
    return <div className={styles.muted}>Sem dados</div>
  }

  return (
    <div className="space-y-4">
      {title && (
        <h3 className={`text-sm font-medium ${styles.muted}`}>
          {title}
        </h3>
      )}

      {bars.map(bar => (
        <div key={bar.label} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{bar.label}</span>
            <span>{bar.value}%</span>
          </div>

          <div
            className={`h-2 rounded ${styles.border} overflow-hidden`}
          >
            <div
              className="h-2 rounded"
              style={{
                width: `${bar.value}%`,
                backgroundColor:
                  bar.value >= 75
                    ? styles.chart.success
                    : bar.value >= 50
                    ? styles.chart.warning
                    : styles.chart.danger,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
