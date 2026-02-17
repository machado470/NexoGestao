import { useEffect, useState } from 'react'
import api from '../../services/api'
import Card from '../../components/base/Card'
import PageHeader from '../../components/base/PageHeader'
import { useTheme } from '../../theme/useTheme'

type Customer = {
  id: string
  name: string
  phone: string
  email?: string | null
  notes?: string | null
  active: boolean
  createdAt: string
}

export default function CustomersPage() {
  const { styles } = useTheme()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<Customer[]>([])
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.get('/customers')
      setItems(res.data ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Erro ao carregar clientes')
    } finally {
      setLoading(false)
    }
  }

  async function create() {
    setError(null)
    try {
      if (!name.trim() || !phone.trim()) {
        setError('Nome e telefone são obrigatórios')
        return
      }

      await api.post('/customers', {
        name,
        phone,
        email: email || undefined,
      })

      setName('')
      setPhone('')
      setEmail('')
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Erro ao criar cliente')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-10">
      <PageHeader
        title="Clientes"
        description="Base de clientes (NexoGestão Oficial)"
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs opacity-60 mb-1">Nome</div>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className={`w-full rounded px-3 py-2 text-sm ${styles.input}`}
              placeholder="Ex: João Silva"
            />
          </div>

          <div>
            <div className="text-xs opacity-60 mb-1">WhatsApp</div>
            <input
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className={`w-full rounded px-3 py-2 text-sm ${styles.input}`}
              placeholder="Ex: 5547999991111"
            />
          </div>

          <div>
            <div className="text-xs opacity-60 mb-1">Email (opcional)</div>
            <input
              value={email}
              onChange={e => setEmail(e.target.value)}
              className={`w-full rounded px-3 py-2 text-sm ${styles.input}`}
              placeholder="ex@email.com"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={create}
            className={`rounded px-4 py-2 text-sm ${styles.buttonPrimary}`}
          >
            Criar cliente
          </button>

          <button
            onClick={load}
            className={`rounded px-4 py-2 text-sm ${styles.buttonSecondary}`}
          >
            Recarregar
          </button>

          {error ? (
            <span className="text-sm text-rose-400">{error}</span>
          ) : null}
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between">
          <div className="font-medium">Lista</div>
          <div className="text-xs opacity-60">
            {loading ? 'Carregando…' : `${items.length} clientes`}
          </div>
        </div>

        <div className="mt-4">
          {loading ? (
            <div className="text-sm opacity-60">Carregando…</div>
          ) : items.length === 0 ? (
            <div className="text-sm opacity-60">Nenhum cliente cadastrado.</div>
          ) : (
            <ul className="space-y-2 text-sm">
              {items.map(c => (
                <li
                  key={c.id}
                  className="flex items-center justify-between rounded border border-white/10 px-3 py-2"
                >
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs opacity-60">
                      {c.phone}{c.email ? ` • ${c.email}` : ''}
                    </div>
                  </div>

                  <div className="text-xs opacity-60">
                    {c.active ? 'ativo' : 'inativo'}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  )
}
