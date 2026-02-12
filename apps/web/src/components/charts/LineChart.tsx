import { useTheme } from '../../theme/useTheme'

type Props = {
  title?: string
  data: number[]
  labels: string[]
}

export function LineChart({ title, data, labels }: Props) {
  const { styles } = useTheme()

  if (!data || data.length === 0) {
    return <div className={styles.muted}>Sem dados</div>
  }

  const max = Math.max(...data)

  const points = data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * 100
      const y = 40 - (value / max) * 32 - 2
      return `${x},${y}`
    })
    .join(' ')

  return (
    <div className="space-y-3">
      {title && (
        <h3 className={`text-sm font-medium ${styles.muted}`}>
          {title}
        </h3>
      )}

      <svg
        viewBox="0 0 100 40"
        className="w-full h-28"
      >
        {/* baseline */}
        <line
          x1="0"
          y1="38"
          x2="100"
          y2="38"
          stroke="currentColor"
          strokeOpacity="0.1"
        />

        {/* curva */}
        <polyline
          fill="none"
          stroke={styles.chart.primary}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={points}
        />
      </svg>

      <div
        className={`
          flex
          justify-between
          text-xs
          ${styles.muted}
          opacity-70
        `}
      >
        {labels.map(label => (
          <span key={label}>{label}</span>
        ))}
      </div>
    </div>
  )
}
