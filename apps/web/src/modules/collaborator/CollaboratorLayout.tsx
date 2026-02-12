import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'
import { useMe } from '../../hooks/useMe'
import Card from '../../components/base/Card'

export default function CollaboratorLayout() {
  const { logout } = useAuth()
  const { me, loading } = useMe()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen">
      <header className="px-6 py-4">
        <Card className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">
              JurisFlow
            </h1>
            <p className="text-xs text-slate-400">
              Área do colaborador
            </p>
          </div>

          <div className="text-right">
            <div className="text-sm font-medium">
              {loading ? '—' : me?.email}
            </div>
            <button
              onClick={handleLogout}
              className="text-xs text-slate-400 hover:underline"
            >
              Sair
            </button>
          </div>
        </Card>
      </header>

      <main className="px-6 pb-10 max-w-5xl mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
