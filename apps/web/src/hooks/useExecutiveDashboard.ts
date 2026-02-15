import { useEffect, useState } from 'react'
import api from '../services/api'

export type ExecutiveDashboardData = {
  people: {
    total: number
    restricted: number
    suspended: number
  }
  risk: {
    average: number
  }
  correctiveActions: {
    open: number
  }
  lastRun: null | {
    createdAt: string
    startedAt: string
    finishedAt: string
    durationMs: number
    evaluated: number
    warnings: number
    correctives: number
    institutionalRiskScore: number
  }
  trend: Array<{
    createdAt: string
    institutionalRiskScore: number
    openCorrectivesCount: number
    restrictedCount: number
    suspendedCount: number
    evaluated: number
    durationMs: number
    finishedAt: string
  }>
}

export function useExecutiveDashboard(): {
  data: ExecutiveDashboardData | null
  loading: boolean
} {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/reports/executive')
      .then(res => setData(res.data))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}

