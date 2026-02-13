import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'
import { useTheme } from '../../theme/useTheme'
import { useAuth } from '../../auth/useAuth'

export default function Login() {
  const { styles } = useTheme()
  const { login } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const ok = await login(email.trim(), password)

    setSubmitting(false)

    if (!ok) {
      setError('Credenciais inválidas.')
      return
    }

    navigate('/admin', { replace: true })
  }

  return (
    <SectionBase>
      <PageHeader
        title="Acesso"
        description="Entre com seu e-mail e senha"
      />

      <Card className="mt-8 max-w-md space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <div className={`text-sm ${styles.textMuted}`}>E-mail</div>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded bg-white/10 border border-white/20"
              placeholder="voce@empresa.com"
              autoComplete="email"
            />
          </div>

          <div>
            <div className={`text-sm ${styles.textMuted}`}>Senha</div>
            <input
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded bg-white/10 border border-white/20"
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-sm text-rose-400">{error}</div>
          )}

          <button
            disabled={submitting}
            className={`w-full py-2 rounded disabled:opacity-50 ${styles.buttonPrimary}`}
            type="submit"
          >
            {submitting ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </Card>
    </SectionBase>
  )
}
