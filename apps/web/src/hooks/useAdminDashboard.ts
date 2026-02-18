import { useEffect, useState } from 'react'
import { getExecutiveReport } from '../services/reports'
import type { ExecutiveReport } from '../services/reports'

export function useAdminDashboard() {
  const [data, setData] = useState<ExecutiveReport | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getExecutiveReport()
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  return { loading, data }
}
