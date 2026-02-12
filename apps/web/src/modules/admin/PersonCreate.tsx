import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import PageHeader from '../../components/base/PageHeader'
import Card from '../../components/base/Card'
import { createPerson } from '../../services/persons'

export default function PersonCreate() {
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] =
    useState<'ADMIN' | 'COLLABORATOR'>('COLLABORATOR')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    try {
      setLoading(true)
      const person = await createPerson({
        name,
        email,
        role,
      })

      navigate(`/admin/pessoas/${person.id}`)
    } catch {
      setError('Erro ao criar pessoa')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title="Criar pessoa" />

      <Card>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            placeholder="Nome"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded bg-slate-800 px-3 py-2 text-white"
          />

          <input
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full rounded bg-slate-800 px-3 py-2 text-white"
          />

          <select
            value={role}
            onChange={e =>
              setRole(e.target.value as any)
            }
            className="w-full rounded bg-slate-800 px-3 py-2 text-white"
          >
            <option value="COLLABORATOR">
              Colaborador
            </option>
            <option value="ADMIN">
              Administrador
            </option>
          </select>

          {error && (
            <div className="text-sm text-red-400">
              {error}
            </div>
          )}

          <button
            disabled={loading}
            className="rounded bg-blue-600 px-4 py-2 text-white"
          >
            {loading ? 'Criando…' : 'Criar pessoa'}
          </button>
        </form>
      </Card>
    </div>
  )
}
