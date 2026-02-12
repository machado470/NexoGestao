
import type { ReactNode } from 'react'
import { useTheme } from '../theme/useTheme'

type Props = {
  children: ReactNode
}

export default function AdminContent({ children }: Props) {
  const { styles } = useTheme()

  return (
    <main
      className={`
        flex-1
        px-8
        pb-16
        ${styles.text}
      `}
    >
      <div className="mx-auto w-full max-w-7xl">
        {children}
      </div>
    </main>
  )
}
