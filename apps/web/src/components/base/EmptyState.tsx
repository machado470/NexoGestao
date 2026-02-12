import type { ReactNode } from 'react'
import { useTheme } from '../../theme/useTheme'

type Tone = 'info' | 'warning' | 'critical'

type Props = {
  title: string
  description?: string
  action?: ReactNode
  tone?: Tone
}

export default function EmptyState({
  title,
  description,
  action,
  tone = 'info',
}: Props) {
  const { styles } = useTheme()

  const toneStyles: Record<Tone, string> = {
    info: '',
    warning: 'border-yellow-500/40',
    critical: 'border-red-500/40',
  }

  return (
    <div
      className={`
        flex
        flex-col
        items-center
        justify-center
        rounded-2xl
        border
        px-8
        py-14
        text-center
        ${styles.surface}
        ${styles.border}
        ${toneStyles[tone]}
      `}
    >
      <div className={`mb-3 text-lg font-semibold ${styles.text}`}>
        {title}
      </div>

      {description && (
        <div className="mb-6 max-w-md text-sm opacity-80">
          {description}
        </div>
      )}

      {action && <div>{action}</div>}
    </div>
  )
}

