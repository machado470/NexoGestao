import api from './api'

export type OperationalState =
  | 'NORMAL'
  | 'RESTRICTED'
  | 'SUSPENDED'

export type OperationalStatus = {
  state: OperationalState
  reason?: string
}

export type Assignment = {
  id: string
  progress: number
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  track: {
    id: string
    title: string
  }
}

export type CorrectiveAction = {
  id: string
  reason: string
  status: 'OPEN' | 'AWAITING_REASSESSMENT' | 'DONE'
  createdAt: string
}

export type PersonOverview = {
  person: {
    id: string
    name: string
    email: string
    role: string
  }
  operational: OperationalStatus
  risk: {
    score: number
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  }
  assignments: Assignment[]
  correctiveActions: CorrectiveAction[]
}

export async function getPersonOverview(
  personId: string,
): Promise<PersonOverview> {
  const { data } = await api.get(
    `/people/${personId}/overview`,
  )
  return data
}
