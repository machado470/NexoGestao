import { useEffect, useState } from 'react'

import Card from '../../components/base/Card'
import PageHeader from '../../components/base/PageHeader'
import SectionBase from '../../components/layout/SectionBase'
import StatusBadge from '../../components/base/StatusBadge'
import EmptyState from '../../components/base/EmptyState'

import api from '../../services/api'

type AuditEvent = {
  id: string
  action: string
  context?: string
  createdAt: string
  person?: {
    name?: string
  }
}

export default function AuditPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<AuditEvent[]>([])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)

    api
      .get('/audit')
      .then(res => {
        if (!mounted) return
        setEvents(res.data?.data ?? [])
      })
      .catch(() => {
        if (!mounted) return
        setError('Não foi possível carregar a auditoria.')
      })
      .finally(() => {
        if (!mounted) return
        setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  return (
    <SectionBase>
      <PageHeader
        title="Auditoria"
        description="Evidências institucionais e histórico de decisões."
      />

      <Card className="mt-6">
        {loading ? (
          <div className="text-sm opacity-60">
            Carregando auditoria…
          </div>
        ) : error ? (
          <div className="text-sm text-red-500">
            {error}
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            title="Nenhum evento registrado"
            description="As decisões institucionais aparecerão aqui."
          />
        ) : (
          <div className="space-y-3">
            {events.map(e => (
              <div
                key={e.id}
                className="
                  p-3 rounded-lg
                  border border-white/10
                "
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {e.action}
                    </div>

                    {e.person?.name && (
                      <div className="text-xs opacity-70 mt-1">
                        Pessoa: {e.person.name}
                      </div>
                    )}

                    <div className="text-xs opacity-60 mt-1">
                      {new Date(
                        e.createdAt,
                      ).toLocaleString()}
                    </div>

                    {e.context && (
                      <div className="text-xs opacity-60 mt-1">
                        {e.context}
                      </div>
                    )}
                  </div>

                  <StatusBadge
                    label="Registro"
                    tone="neutral"
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </SectionBase>
  )
}

