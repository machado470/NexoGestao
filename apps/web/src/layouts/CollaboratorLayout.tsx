import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { useMe } from '../hooks/useMe'

export default function CollaboratorLayout() {
  const { logout } = useAuth()
  const { me, loading } = useMe()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-6 py-4">
        <div className="font-bold">
          JurisFlow · Colaborador
        </div>

        <div className="flex items-center gap-4">
          <span className="text-sm opacity-70">
            {loading ? '—' : me?.email}
          </span>

          <button
            onClick={() => {
              logout()
              navigate('/login')
            }}
            className="rounded bg-slate-800 px-3 py-1 text-sm hover:bg-slate-700"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="p-6">
        <Outlet />
      </main>
    </div>
  )
}
