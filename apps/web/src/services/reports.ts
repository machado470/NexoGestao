import api from './api'

export type Urgency = 'OK' | 'WARNING' | 'CRITICAL'

export type NextAction =
  | { type: 'RESOLVE_CORRECTIVE'; count: number }
  | { type: 'START_ASSIGNMENT'; assignmentId: string; trackId: string; trackTitle: string }
  | { type: 'NONE' }

export type PersonOverview = {
  id: string
  name: string
  status: Urgency
  state: 'NORMAL' | 'WARNING' | 'RESTRICTED' | 'SUSPENDED'
  riskScore: number
  contributors: string[]
  factors: { avgProgress: number; openCorrectives: number }
  reason: string
  nextAction: NextAction
}

export type TrackOverview = {
  id: string
  title: string
  peopleCount: number
  completionRate: number
  status: 'SUCCESS' | 'WARNING' | 'CRITICAL'
}

export type ExecutiveReport = {
  peopleStats: Record<Urgency, number>
  correctiveOpenCount: number
  people: PersonOverview[]
  tracks: TrackOverview[]
  timeline: any[]
}

// ✅ endpoint real na API: GET /reports/executive-report
export async function getExecutiveReport(): Promise<ExecutiveReport> {
  const res = await api.get('/reports/executive-report')
  return res.data
}

// ✅ endpoint real na API: GET /reports/metrics?days=30
export async function getExecutiveMetrics(days = 30) {
  const res = await api.get('/reports/metrics', { params: { days } })
  return res.data
}
