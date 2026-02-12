import api from './api'

export type PersonAssignment = {
  id: string
  progress: number
  track: {
    id: string
    title: string
  }
}

/**
 * 📋 Lista assignments abertos de uma pessoa
 * Backend: GET /assignments/person/:personId
 */
export async function listAssignmentsByPerson(
  personId: string,
) {
  const res = await api.get<PersonAssignment[]>(
    `/assignments/person/${personId}`,
  )
  return res.data
}

/**
 * ▶️ Inicia assignment (progress 0 → 1)
 * Backend: POST /assignments/:id/start
 */
export async function startPersonAssignment(
  assignmentId: string,
) {
  const res = await api.post(
    `/assignments/${assignmentId}/start`,
  )
  return res.data
}

/**
 * 🔄 Atualiza progresso (1..99)
 * Backend: PATCH /assignments/:id/progress
 */
export async function updatePersonAssignmentProgress(
  assignmentId: string,
  progress: number,
) {
  const res = await api.patch(
    `/assignments/${assignmentId}/progress`,
    { progress },
  )
  return res.data
}
