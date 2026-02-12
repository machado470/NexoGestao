import { useEffect, useState } from 'react'
import api from '../services/api'

export type AuditEvent = {
  id: string
  action: string
  context?: string
  createdAt: string
  person?: {
    name: string
  }
}

export function useAudit() {
  const [events, setEvents] = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    try {
      const res = await api.get('/audit')
      setEvents(res.data.data ?? res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return {
    events,
    loading,
    reload: load,
  }
}
