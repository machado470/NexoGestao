import type { ReactNode } from 'react'
import { useTheme } from '../../theme/useTheme'

export default function AuthLayout({
  children,
}: {
  children: ReactNode
}) {
  const { styles } = useTheme()

  return (
    <div
      className={`
        min-h-screen
        flex items-center justify-center
        px-6
        ${styles.background}
        ${styles.textPrimary}
      `}
    >
      <div className="w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center">
        <div className={`hidden md:block ${styles.textPrimary}`}>
          <h1 className="text-4xl font-semibold leading-tight">
            NexoGestao
          </h1>

          <p className={`mt-4 max-w-md ${styles.textMuted}`}>
            Governança operacional com trilhas, risco humano e auditoria
            para times que precisam operar com dados reais.
          </p>
        </div>

        <div
          className={`
            rounded-2xl
            border
            p-8
            ${styles.surface}
            ${styles.border}
          `}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
