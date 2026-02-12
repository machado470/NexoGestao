import api from './api'

export type AssignmentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'COMPLETED'

export type MyAssignment = {
  id: string
  progress: number
  status: AssignmentStatus
  track: {
    id: string
    title: string
  }
}

export async function listMyAssignments() {
  const res = await api.get<MyAssignment[]>(
    '/assignments/my',
  )
  return res.data
}

export async function startAssignment(id: string) {
  const res = await api.post(
    `/assignments/${id}/start`,
  )
  return res.data
}

export async function completeAssignment(id: string) {
  const res = await api.post(
    `/assignments/${id}/complete`,
  )
  return res.data
}
