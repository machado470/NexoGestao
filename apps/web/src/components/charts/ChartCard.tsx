import type { ReactNode } from 'react'
import { useTheme } from '../../theme/useTheme'

type Props = {
  title?: string
  children: ReactNode
}

export function ChartCard({ title, children }: Props) {
  const { styles } = useTheme()

  return (
    <div
      className={`border ${styles.border} ${styles.surface} rounded p-4 space-y-4`}
    >
      {title && (
        <h3 className={`text-sm font-semibold ${styles.muted}`}>
          {title}
        </h3>
      )}

      {children}
    </div>
  )
}
