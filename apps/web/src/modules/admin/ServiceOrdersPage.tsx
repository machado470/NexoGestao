import { useEffect, useState } from 'react'
import api from '../../services/api'
import Card from '../../components/base/Card'
import PageHeader from '../../components/base/PageHeader'
import { useTheme } from '../../theme/useTheme'

type ServiceOrder = {
  id: string
  title: string
  description?: string | null
  status: 'OPEN' | 'ASSIGNED' | 'IN_PROGRESS' | 'DONE' | 'CANCELED'
  priority: number
  scheduledFor?: string | null
  createdAt: string
  customer: { id: string; name: string; phone: string }
  assignedToPerson?: { id: string; name: string } | null
}

type Customer = {
  id: string
  name: string
}

export default function ServiceOrdersPage() {
  const { styles } = useTheme()

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState<ServiceOrder[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [error, setError] = useState<string | null>(null)

  const [customerId, setCustomerId] = useState('')
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState(2)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [osRes, custRes] = await Promise.all([
        api.get('/service-orders'),
        api.get('/customers'),
      ])
      setItems(osRes.data ?? [])
      setCustomers(custRes.data ?? [])
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Erro ao carregar O.S.')
    } finally {
      setLoading(false)
    }
  }

  async function create() {
    setError(null)
    try {
      if (!customerId) {
        setError('Selecione um cliente')
        return
      }
      if (!title.trim()) {
        setError('Título é obrigatório')
        return
      }

      await api.post('/service-orders', {
        customerId,
        title,
        priority,
      })

      setTitle('')
      setPriority(2)
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Erro ao criar O.S.')
    }
  }

  async function setStatus(id: string, status: ServiceOrder['status']) {
    setError(null)
    try {
      await api.patch(`/service-orders/${id}`, { status })
      await load()
    } catch (e: any) {
      setError(e?.response?.data?.error?.message ?? 'Erro ao atualizar status')
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="space-y-10">
      <PageHeader
        title="Ordens de Serviço"
        description="Execução operacional (MVP) — cria, acompanha e encerra serviços"
      />

      <Card>
        <div className="grid gap-3 md:grid-cols-3">
          <div>
            <div className="text-xs opacity-60 mb-1">Cliente</div>
            <select
              value={customerId}
              onChange={e => setCustomerId(e.target.value)}
              className={`w-full rounded px-3 py-2 text-sm ${styles.input}`}
            >
              <option value="">Selecione…</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs opacity-60 mb-1">Título</div>
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className={`w-full rounded px-3 py-2 text-sm ${styles.input}`}
              placeholder="Ex: Limpeza / execução padrão"
            />
          </div>

          <div>
            <div className="text-xs opacity-60 mb-1">Prioridade (1–5)</div>
            <input
              type="number"
              min={1}
              max={5}
              value={priority}
              onChange={e => setPriority(Number(e.target.value))}
              className={`w-full rounded px-3 py-2 text-sm ${styles.input}`}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={create}
            className={`rounded px-4 py-2 text-sm ${styles.buttonPrimary}`}
          >
            Criar O.S.
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

      <Card header="Lista" right={<div className="text-xs opacity-60">{loading ? 'Carregando…' : `${items.length} O.S.`}</div>}>
        {loading ? (
          <div className="text-sm opacity-60">Carregando…</div>
        ) : items.length === 0 ? (
          <div className="text-sm opacity-60">Nenhuma O.S. criada.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map(os => (
              <li
                key={os.id}
                className="rounded border border-white/10 px-3 py-3 flex flex-col gap-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{os.title}</div>
                    <div className="text-xs opacity-60">
                      {os.customer.name} • {os.customer.phone} • prioridade {os.priority}
                    </div>
                    <div className="text-xs opacity-60">
                      status: <span className="font-medium">{os.status}</span>
                      {os.assignedToPerson ? ` • atribuído: ${os.assignedToPerson.name}` : ''}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setStatus(os.id, 'OPEN')}
                      className={`text-xs rounded px-3 py-1 ${styles.buttonSecondary}`}
                    >
                      OPEN
                    </button>
                    <button
                      onClick={() => setStatus(os.id, 'ASSIGNED')}
                      className={`text-xs rounded px-3 py-1 ${styles.buttonSecondary}`}
                    >
                      ASSIGNED
                    </button>
                    <button
                      onClick={() => setStatus(os.id, 'IN_PROGRESS')}
                      className={`text-xs rounded px-3 py-1 ${styles.buttonSecondary}`}
                    >
                      IN_PROGRESS
                    </button>
                    <button
                      onClick={() => setStatus(os.id, 'DONE')}
                      className={`text-xs rounded px-3 py-1 ${styles.buttonPrimary}`}
                    >
                      DONE
                    </button>
                    <button
                      onClick={() => setStatus(os.id, 'CANCELED')}
                      className={`text-xs rounded px-3 py-1 ${styles.buttonSecondary}`}
                    >
                      CANCELED
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
