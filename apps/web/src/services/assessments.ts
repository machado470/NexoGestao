import api from './api'

export async function submitAssessment(params: {
  assignmentId: string
  score: number
  notes?: string
}) {
  await api.post('/assessments', params)
}
