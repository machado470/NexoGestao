import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import api from '../../services/api'
import AuthLayout from './AuthLayout'

export default function ActivateAccount() {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const token = params.get('token')

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!token) {
      setError('Convite inválido')
      return
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    if (password !== confirm) {
      setError('As senhas não coincidem')
      return
    }

    try {
      setLoading(true)

      await api.post('/auth/activate', {
        token,
        password,
      })

      navigate('/login')
    } catch {
      setError('Convite inválido ou expirado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-semibold text-white mb-6">
        Ativar conta
      </h2>

      <p className="text-sm text-slate-400 mb-6">
        Defina sua senha para acessar o sistema.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="password"
          placeholder="Nova senha"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          className="
            w-full rounded-lg bg-white/5
            px-4 py-3 text-sm text-white
            outline-none ring-1 ring-white/10
            focus:ring-blue-500/40
          "
        />

        <input
          type="password"
          placeholder="Confirmar senha"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          required
          className="
            w-full rounded-lg bg-white/5
            px-4 py-3 text-sm text-white
            outline-none ring-1 ring-white/10
            focus:ring-blue-500/40
          "
        />

        {error && (
          <div className="text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="
            w-full rounded-lg bg-blue-600
            px-4 py-3 text-sm font-medium text-white
            hover:bg-blue-500 transition
            disabled:opacity-50
          "
        >
          {loading ? 'Ativando…' : 'Ativar conta'}
        </button>
      </form>
    </AuthLayout>
  )
}
