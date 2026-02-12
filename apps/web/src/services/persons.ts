import api from './api'

export type PersonSummary = {
  id: string
  name: string
  email?: string
  role: string
  active: boolean
  riskScore: number
}

export async function listPeople() {
  const res = await api.get<PersonSummary[]>(
    '/people',
  )
  return res.data
}

export async function createPerson(data: {
  name: string
  email?: string
  role: 'ADMIN' | 'COLLABORATOR'
}) {
  const res = await api.post('/people', data)
  return res.data
}
