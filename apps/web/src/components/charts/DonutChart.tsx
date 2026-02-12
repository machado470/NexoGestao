import { useTheme } from '../../theme/useTheme'

type Slice = {
  label: string
  value: number
}

type Props = {
  title?: string
  slices: Slice[]
}

export function DonutChart({ title, slices }: Props) {
  const { styles } = useTheme()

  const total = slices.reduce((acc, s) => acc + s.value, 0)

  if (!total) {
    return <div className={styles.muted}>Sem dados</div>
  }

  let offset = 25

  const colors = [
    styles.chart.success,
    styles.chart.warning,
    styles.chart.danger,
    styles.chart.primary,
  ]

  return (
    <div className="flex items-center gap-6">
      {/* Donut */}
      <svg
        viewBox="0 0 42 42"
        className="w-32 h-32"
      >
        {/* base */}
        <circle
          cx="21"
          cy="21"
          r="15.9"
          fill="transparent"
          stroke="currentColor"
          strokeOpacity="0.1"
          strokeWidth="3"
        />

        {slices.map((slice, i) => {
          const percentage = (slice.value / total) * 100
          const stroke = colors[i % colors.length]

          const circle = (
            <circle
              key={slice.label}
              cx="21"
              cy="21"
              r="15.9"
              fill="transparent"
              stroke={stroke}
              strokeWidth="3"
              strokeDasharray={`${percentage} ${100 - percentage}`}
              strokeDashoffset={offset}
            />
          )

          offset -= percentage
          return circle
        })}
      </svg>

      {/* Legenda */}
      <div className="space-y-2 text-sm">
        {title && (
          <div
            className={`font-medium ${styles.muted}`}
          >
            {title}
          </div>
        )}

        {slices.map((slice, i) => (
          <div
            key={slice.label}
            className="flex items-center gap-3 opacity-80"
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor:
                  colors[i % colors.length],
              }}
            />
            <span className="flex-1">
              {slice.label}
            </span>
            <span className="font-medium">
              {slice.value}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
