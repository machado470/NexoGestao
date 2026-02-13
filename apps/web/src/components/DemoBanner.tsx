import { useTheme } from '../theme/useTheme'

export default function DemoBanner() {
  const { styles } = useTheme()

  return (
    <div className={`rounded px-3 py-2 text-sm border ${styles.cardBorder} ${styles.cardBg}`}>
      <span className={styles.textMuted}>
        Ambiente demo — dados de exemplo.
      </span>
    </div>
  )
}
