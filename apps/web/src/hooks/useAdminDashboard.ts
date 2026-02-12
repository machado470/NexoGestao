import { useEffect, useMemo, useState } from 'react'
import { getExecutiveReport } from '../services/reports'
import type { ExecutiveReport } from '../services/reports'

export function useAdminDashboard() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<ExecutiveReport | null>(null)

  async function load() {
    setLoading(true)
    try {
      const report = await getExecutiveReport()
      setData(report)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return useMemo(
    () => ({
      loading,
      data,
      reload: load,
    }),
    [loading, data],
  )
}
