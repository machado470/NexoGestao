import { useEffect, useState } from 'react'
import api from '../services/api'

export function usePersonDetail(personId?: string) {
  const [person, setPerson] = useState<any>(null)
  const [audit, setAudit] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!personId) return

    Promise.all([
      api.get(`/people/${personId}`),
      api.get(`/audit?personId=${personId}`),
    ])
      .then(([personRes, auditRes]) => {
        setPerson(personRes.data)
        setAudit(auditRes.data)
      })
      .finally(() => setLoading(false))
  }, [personId])

  return { person, audit, loading }
}
