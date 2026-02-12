import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Card from '../../components/base/Card'
import SectionBase from '../../components/layout/SectionBase'
import api from '../../services/api'

export default function AdminOnboarding() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Informe o nome do administrador')
      return
    }

    try {
      setLoading(true)

      await api.post('/onboarding/admin', {
        name: name.trim(),
      })

      /**
       * ✅ FECHAMENTO DO CICLO
       * O backend já atualizou o estado.
       * /me refletirá isso automaticamente.
       */
      navigate('/admin', { replace: true })
    } catch (err: any) {
      setError(
        err?.response?.data?.message ??
          'Erro ao concluir onboarding',
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <SectionBase>
      <div className="min-h-[80vh] flex items-center justify-center px-6">
        <Card className="w-full max-w-md p-10">
          <h1 className="text-xl font-semibold text-white">
            Configuração inicial
          </h1>

          <form
            onSubmit={handleSubmit}
            className="mt-6 space-y-4"
          >
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome do administrador"
              className="w-full px-4 py-2 rounded bg-slate-800 text-white"
            />

            {error && (
              <div className="text-red-400 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full px-6 py-3 rounded bg-blue-600 text-white"
            >
              {loading
                ? 'Concluindo…'
                : 'Concluir configuração'}
            </button>
          </form>
        </Card>
      </div>
    </SectionBase>
  )
}
