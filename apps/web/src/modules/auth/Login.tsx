import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../auth/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const success = await login(email, password)

    if (!success) {
      setError('Credenciais inválidas')
      setLoading(false)
      return
    }

    /**
     * ✅ LOGIN NÃO DECIDE ROTA
     * Ele só autentica.
     * A decisão é feita depois via /me.
     */
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 p-6 rounded-xl bg-slate-900 border border-slate-800"
      >
        <h1 className="text-xl font-semibold text-center">
          Acesso ao sistema
        </h1>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700"
          required
        />

        <input
          type="password"
          placeholder="Senha"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700"
          required
        />

        {error && (
          <div className="text-sm text-red-400">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
