import { Link } from 'react-router-dom'
import { useTheme } from '../../theme/useTheme'

export default function LandingHeader() {
  const { styles } = useTheme()

  return (
    <header
      className={`
        sticky top-0 z-40
        border-b
        ${styles.surface}
        ${styles.border}
      `}
    >
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link
          to="/"
          className={`font-semibold ${styles.textPrimary}`}
        >
          JurisFlow
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to="/login"
            className={`
              px-4 py-2 text-sm rounded-lg
              border
              ${styles.border}
              ${styles.textMuted}
              hover:${styles.navHover}
              transition
            `}
          >
            Entrar
          </Link>

          <a
            href="#cta"
            className={`
              px-4 py-2 text-sm rounded-lg
              ${styles.buttonPrimary}
              transition
            `}
          >
            Solicitar acesso
          </a>
        </div>
      </div>
    </header>
  )
}
