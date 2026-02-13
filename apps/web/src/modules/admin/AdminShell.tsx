import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useTheme } from '../../theme/useTheme'

export default function AdminShell() {
  const { styles } = useTheme()
  const { logout } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className={`min-h-screen ${styles.background} ${styles.textPrimary}`}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold">Admin</div>

          <button
            onClick={handleLogout}
            className={`text-xs rounded px-3 py-1 ${styles.buttonPrimary}`}
          >
            Sair
          </button>
        </div>

        <div className="mt-6">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
