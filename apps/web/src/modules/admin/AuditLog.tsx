import { useEffect, useState } from 'react'
import api from '../../services/api'

type AuditEvent = {
  id: string
  entity: string
  entityId: string
  action: string
  createdAt: string
  meta?: any
}

export default function AuditLog() {
  const [logs, setLogs] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/audit')
      .then(res => setLogs(res.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Auditoria do Sistema</h1>

      {loading && (
        <div className="text-zinc-400">Carregando auditoria...</div>
      )}

      {!loading && logs.length === 0 && (
        <div className="text-zinc-400">Nenhum evento registrado</div>
      )}

      <div className="space-y-3">
        {logs.map(log => (
          <div
            key={log.id}
            className="p-4 rounded border border-zinc-800"
          >
            <div className="font-semibold">
              {log.entity.toUpperCase()} — {log.action}
            </div>

            <div className="text-sm text-zinc-400">
              {new Date(log.createdAt).toLocaleString()}
            </div>

            {log.meta && (
              <pre className="mt-2 text-xs text-zinc-400">
                {JSON.stringify(log.meta, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
