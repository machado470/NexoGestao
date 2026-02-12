import api from './api'

export type ExecutiveReport = {
  peopleStats: {
    OK: number
    WARNING: number
    CRITICAL: number
  }
  correctiveOpenCount: number
  people: {
    id: string
    name: string
    department?: string
    status: 'OK' | 'WARNING' | 'CRITICAL'
  }[]
}

export type ExecutiveMetrics = {
  correctiveSLA: {
    windowDays: number
    totalActions: number
    resolvedSamples: number
    closedSamples: number
    avgResolveHours: number | null
    avgCloseHours: number | null
  }
}

export async function getExecutiveReport() {
  const res = await api.get<ExecutiveReport>(
    '/reports/executive',
  )
  return res.data
}

export async function getExecutiveMetrics(days = 30) {
  const res = await api.get<ExecutiveMetrics>(
    '/reports/executive/metrics',
    {
      params: { days },
    },
  )
  return res.data
}
