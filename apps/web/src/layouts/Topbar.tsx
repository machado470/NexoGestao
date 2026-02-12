import { useTheme } from '../theme/useTheme'
import ToggleThemeButton from '../components/ToggleThemeButton'
import UserMenu from '../components/layout/UserMenu'

export default function Topbar() {
  const { styles } = useTheme()

  return (
    <header
      className={`
        mb-6 flex items-center justify-between
        rounded-xl border p-4
        ${styles.surface}
        ${styles.border}
      `}
    >
      <div className={`text-sm font-semibold ${styles.text}`}>
        Painel Administrativo
      </div>

      <div className="flex items-center gap-4">
        <ToggleThemeButton />
        <UserMenu />
      </div>
    </header>
  )
}
