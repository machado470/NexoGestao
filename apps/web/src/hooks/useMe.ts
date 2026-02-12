import { useEffect, useState } from 'react'
import api from '../services/api'

export type OperationalState =
  | 'NORMAL'
  | 'WARNING'
  | 'RESTRICTED'
  | 'SUSPENDED'

export interface Me {
  id: string
  email: string
  role: 'ADMIN' | 'COLLABORATOR'
  orgId: string
  personId: string | null
  operationalState: {
    state: OperationalState
    severity: 'success' | 'warning' | 'danger'
    message: string
  }
}

export function useMe() {
  const [me, setMe] = useState<Me | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<Me>('/me')
      .then((res) => setMe(res.data))
      .catch(() => setMe(null))
      .finally(() => setLoading(false))
  }, [])

  return { me, loading }
}
