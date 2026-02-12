import api from './api'

export type CorrectiveActionStatus =
  | 'OPEN'
  | 'AWAITING_REASSESSMENT'
  | 'DONE'

export type CorrectiveAction = {
  id: string
  personId: string
  reason: string
  status: CorrectiveActionStatus
  createdAt: string
  resolvedAt?: string | null
}

export async function getCorrectiveActionsByPerson(
  personId: string,
): Promise<CorrectiveAction[]> {
  const res = await api.get(
    `/corrective-actions/person/${personId}`,
  )
  return res.data
}

export async function createCorrectiveAction(
  personId: string,
  reason: string,
): Promise<CorrectiveAction> {
  const res = await api.post('/corrective-actions', {
    personId,
    reason,
  })
  return res.data
}

export async function resolveCorrectiveAction(
  correctiveActionId: string,
): Promise<CorrectiveAction> {
  const res = await api.post(
    `/corrective-actions/${correctiveActionId}/resolve`,
  )
  return res.data
}
