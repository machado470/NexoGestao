import type { ReactNode } from 'react'
import { useTheme } from '../../theme/useTheme'

type Props = {
  title: string
  description?: string
  action?: ReactNode
}

export default function PageHeader({
  title,
  description,
  action,
}: Props) {
  const { styles } = useTheme()

  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className={`text-2xl font-semibold ${styles.text}`}>
          {title}
        </h1>

        {description && (
          <p className={`mt-1 text-sm ${styles.muted}`}>
            {description}
          </p>
        )}
      </div>

      {action && <div>{action}</div>}
    </div>
  )
}
