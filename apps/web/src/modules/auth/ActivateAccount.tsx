import { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'
import { useTheme } from '../../theme/ThemeProvider'
import { activateAccount } from '../../services/auth'

export default function ActivateAccount() {
  const { styles } = useTheme()
  const [searchParams] = useSearchParams()

  const token = searchParams.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [ok, setOk] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
  }, [password, confirm])

  async function submit() {
    if (!token) {
      setError('Token inválido')
      return
    }

    if (!password || password.length < 6) {
      setError('Senha deve ter pelo menos 6 caracteres')
      return
    }

    if (password !== confirm) {
      setError('As senhas não conferem')
      return
    }

    setLoading(true)
    setError(null)

    try {
      await activateAccount({ token, password })
      setOk(true)
    } catch {
      setError('Não foi possível ativar a conta')
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionBase>
      <div className="max-w-lg mx-auto py-20">
        <Card className="p-8">
          <h1 className="text-xl font-semibold">Ativar conta</h1>
          <p className={`mt-2 text-sm ${styles.textMuted}`}>
            Defina sua senha para concluir a ativação.
          </p>

          {ok ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-emerald-400">
                Conta ativada com sucesso.
              </p>
              <Link to="/login" className={`text-sm underline ${styles.accent}`}>
                Ir para login
              </Link>
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              <div>
                <label className={`text-sm ${styles.textMuted}`}>
                  Nova senha
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={`
                    mt-1 w-full rounded-lg px-3 py-2 text-sm
                    bg-white/10 border border-white/20
                    focus:outline-none focus:ring-2 focus:ring-[#F97316]/40
                  `}
                />
              </div>

              <div>
                <label className={`text-sm ${styles.textMuted}`}>
                  Confirmar senha
                </label>
                <input
                  type="password"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className={`
                    mt-1 w-full rounded-lg px-3 py-2 text-sm
                    bg-white/10 border border-white/20
                    focus:outline-none focus:ring-2 focus:ring-[#F97316]/40
                  `}
                />
              </div>

              {error && <p className="text-sm text-rose-400">{error}</p>}

              <button
                onClick={submit}
                disabled={loading}
                className={`w-full rounded-lg px-4 py-2 text-sm transition disabled:opacity-50 ${styles.buttonPrimary}`}
              >
                {loading ? 'Ativando…' : 'Ativar conta'}
              </button>
            </div>
          )}
        </Card>
      </div>
    </SectionBase>
  )
}
