import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../../services/api'

type PendingItem = {
  personId: string
  personName: string
  risk: 'HIGH' | 'CRITICAL'
  actionId: string
  reason: string
}

export default function Pending() {
  const [items, setItems] = useState<PendingItem[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const res = await api.get('/reports/pending')
    setItems(res.data.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  if (loading) {
    return (
      <div className="text-slate-400">
        Carregando pendências…
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        Pendências
      </h1>

      {items.length === 0 ? (
        <div className="bg-slate-900 rounded p-6 text-slate-400">
          Nenhuma pendência no momento.
        </div>
      ) : (
        <div className="bg-slate-900 rounded divide-y divide-slate-800">
          {items.map(p => (
            <Link
              key={p.actionId}
              to={`/admin/persons/${p.personId}`}
              className="block px-4 py-3 hover:bg-slate-800"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">
                    {p.personName}
                  </div>
                  <div className="text-sm text-slate-400">
                    {p.reason}
                  </div>
                </div>

                <span
                  className={
                    p.risk === 'CRITICAL'
                      ? 'text-red-400'
                      : 'text-yellow-400'
                  }
                >
                  {p.risk}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
