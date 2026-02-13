import { useEffect, useMemo, useState } from 'react'
import api from '../services/api'

export type DashboardPerson = {
  id: string
  name: string
  status: 'OK' | 'WARNING' | 'CRITICAL'
  department?: string | null
}

export type PeopleStats = {
  OK: number
  WARNING: number
  CRITICAL: number
}

export function useExecutiveDashboard(): {
  data: any
  loading: boolean
  peopleStats: PeopleStats
  correctiveOpenCount: number
  people: DashboardPerson[]
} {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/reports/executive')
      .then(res => setData(res.data))
      .finally(() => setLoading(false))
  }, [])

  const peopleStats = useMemo<PeopleStats>(() => {
    if (!data) return { OK: 0, WARNING: 0, CRITICAL: 0 }
    if (data.peopleStats) return data.peopleStats as PeopleStats

    const p = data.people || {}
    return {
      OK: Number(p.normal ?? 0),
      WARNING: Number(p.warning ?? 0),
      CRITICAL: Number(p.restricted ?? 0) + Number(p.suspended ?? 0),
    }
  }, [data])

  const correctiveOpenCount = useMemo(() => {
    if (!data) return 0
    return Number(data.correctiveOpenCount ?? data.correctiveActions?.open ?? 0)
  }, [data])

  const people = useMemo<DashboardPerson[]>(() => {
    const list = data?.peopleList ?? data?.people ?? []
    return Array.isArray(list) ? (list as DashboardPerson[]) : []
  }, [data])

  return { data, loading, peopleStats, correctiveOpenCount, people }
}
