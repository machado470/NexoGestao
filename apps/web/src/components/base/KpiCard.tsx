import { useTheme } from '../../theme/useTheme'

type Props = {
  label: string
  value: string | number
}

export default function KpiCard({ label, value }: Props) {
  const { styles } = useTheme()

  return (
    <div
      className={`
        rounded-lg border p-4
        ${styles.surface}
        ${styles.border}
      `}
    >
      <div className="text-xs opacity-60">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">
        {value}
      </div>
    </div>
  )
}
