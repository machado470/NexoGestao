import { useEffect, useState } from 'react'
import api from '../services/api'

export type PersonStatus =
  | 'NORMAL'
  | 'WARNING'
  | 'RESTRICTED'
  | 'SUSPENDED'
  | 'CRITICAL'

export type PersonOverview = {
  id: string
  name: string
  department?: string | null
  status: PersonStatus
  riskScore: number
}

export type ExecutiveDashboardData = {
  peopleStats: {
    total: number
    NORMAL: number
    WARNING: number
    RESTRICTED: number
    SUSPENDED: number
    CRITICAL: number
  }
  correctiveOpenCount: number
  people: PersonOverview[]
}

export function useExecutiveDashboard() {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/reports/executive-dashboard')
      .then(res => setData(res.data))
      .finally(() => setLoading(false))
  }, [])

  return {
    loading,
    peopleStats: data?.peopleStats ?? {
      total: 0,
      NORMAL: 0,
      WARNING: 0,
      RESTRICTED: 0,
      SUSPENDED: 0,
      CRITICAL: 0
    },
    correctiveOpenCount: data?.correctiveOpenCount ?? 0,
    people: data?.people ?? []
  }
}
