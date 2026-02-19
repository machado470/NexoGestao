import { Outlet, useNavigate, NavLink } from 'react-router-dom'
import { useAuth } from '../../auth/useAuth'
import { useTheme } from '../../theme/useTheme'

function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `text-xs rounded px-3 py-1 border border-white/10 ${
          isActive ? 'bg-white/10' : 'bg-transparent'
        }`
      }
    >
      {label}
    </NavLink>
  )
}

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
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="text-lg font-semibold">Admin</div>

            <div className="flex items-center gap-2">
              <NavItem to="/admin" label="Dashboard" />
              <NavItem to="/admin/pessoas" label="Pessoas" />
              <NavItem to="/admin/trilhas" label="Trilhas" />
              <NavItem to="/admin/clientes" label="Clientes" />
              <NavItem to="/admin/os" label="O.S." />
            </div>
          </div>

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
