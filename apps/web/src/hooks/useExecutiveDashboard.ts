import { useEffect, useState } from 'react'
import api from '../services/api'

export type ExecutiveDashboard = {
  people: {
    total: number
    normal: number
    warning: number
    restricted: number
    suspended: number
  }
  risk: {
    average: number
  }
  correctiveActions: {
    open: number
  }
}

export function useExecutiveDashboard() {
  const [data, setData] =
    useState<ExecutiveDashboard | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get('/reports/executive')
      .then(res => setData(res.data))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
