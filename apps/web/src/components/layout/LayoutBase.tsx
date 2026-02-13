import type { ReactNode } from 'react'
import { useTheme } from '../../theme/ThemeProvider'
import LandingHeader from './LandingHeader'

export default function LayoutBase({
  children,
}: {
  children: ReactNode
}) {
  const { styles } = useTheme()

  return (
    <div
      className={`
        relative
        min-h-screen
        overflow-hidden
        ${styles.bg}
        ${styles.textPrimary}
      `}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_65%_35%,rgba(249,115,22,0.10),transparent_60%)] animate-[pulse_14s_ease-in-out_infinite]" />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_25%_70%,rgba(249,115,22,0.08),transparent_65%)]" />

      <div className="relative z-10">
        <LandingHeader />
        {children}
      </div>
    </div>
  )
}
