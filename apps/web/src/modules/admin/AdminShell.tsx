import { NavLink, Outlet } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../auth/AuthContext'
import { useMe } from '../../hooks/useMe'
import { useTheme } from '../../theme/useTheme'

import ToggleThemeButton from '../../components/ToggleThemeButton'
import OperationStatus from '../../components/OperationStatus'
import Avatar from '../../components/Avatar'

import ChevronDownIcon from '../../components/icons/ChevronDownIcon'
import LogoutIcon from '../../components/icons/LogoutIcon'

import DashboardIcon from '../../components/icons/DashboardIcon'
import TracksIcon from '../../components/icons/TracksIcon'
import EvaluationsIcon from '../../components/icons/EvaluationsIcon'
import UsersIcon from '../../components/icons/UsersIcon'
import AuditIcon from '../../components/icons/AuditIcon'

export default function AdminShell() {
  const { logout } = useAuth()
  const { me, loading } = useMe()
  const { styles } = useTheme()

  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () =>
      document.removeEventListener(
        'mousedown',
        handleClickOutside,
      )
  }, [])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `
      flex items-center gap-3 px-4 py-2 rounded-lg text-sm
      transition-colors
      ${
        isActive
          ? `${styles.navActive} ${styles.textPrimary}`
          : `${styles.textMuted} hover:${styles.navHover}`
      }
    `

  return (
    <div
      className={`
        min-h-screen flex
        ${styles.background}
        ${styles.textPrimary}
      `}
    >
      {/* SIDEBAR */}
      <aside
        className={`
          w-64 p-4
          border-r
          ${styles.border}
          ${styles.surface}
        `}
      >
        <div className="text-xl font-semibold mb-8">
          Juris<span className={styles.accent}>Flow</span>
        </div>

        <nav className="space-y-1">
          <NavLink to="/admin" end className={linkClass}>
            <DashboardIcon />
            Dashboard
          </NavLink>

          <NavLink to="/admin/trilhas" className={linkClass}>
            <TracksIcon />
            Trilhas
          </NavLink>

          <NavLink to="/admin/avaliacoes" className={linkClass}>
            <EvaluationsIcon />
            Avaliações
          </NavLink>

          <NavLink to="/admin/pessoas" className={linkClass}>
            <UsersIcon />
            Pessoas
          </NavLink>

          <NavLink to="/admin/auditoria" className={linkClass}>
            <AuditIcon />
            Auditoria
          </NavLink>
        </nav>
      </aside>

      {/* CONTEÚDO */}
      <div className="flex-1 flex flex-col">
        {/* TOPBAR */}
        <header
          className={`
            h-16 px-6 flex items-center justify-between
            border-b
            ${styles.border}
            ${styles.surface}
          `}
        >
          <OperationStatus />

          <div
            ref={menuRef}
            className="flex items-center gap-3 relative"
          >
            <ToggleThemeButton />

            <button
              onClick={() => setOpen(o => !o)}
              className={`
                flex items-center gap-2 text-sm
                ${styles.textMuted}
                hover:${styles.textPrimary}
                transition
              `}
            >
              <Avatar
                name={
                  loading
                    ? '—'
                    : me?.email ?? 'Admin'
                }
              />
              <ChevronDownIcon className="w-4 h-4" />
            </button>

            {open && (
              <div
                className={`
                  absolute right-0 top-10 w-40 rounded-md
                  shadow-lg
                  ${styles.surface}
                  ${styles.border}
                `}
              >
                <button
                  onClick={logout}
                  className={`
                    w-full flex items-center gap-2
                    px-4 py-2 text-sm
                    ${styles.textMuted}
                    hover:${styles.textPrimary}
                    hover:${styles.navHover}
                    transition
                  `}
                >
                  <LogoutIcon className="w-4 h-4" />
                  Sair
                </button>
              </div>
            )}
          </div>
        </header>

        {/* MAIN */}
        <main
          className={`
            flex-1 p-6 lg:p-8
            ${styles.background}
          `}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}
