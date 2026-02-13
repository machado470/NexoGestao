import api from './api'

export type Person = {
  id: string
  name: string
  department?: string | null
  status: string
}

function normalizePerson(input: any): Person {
  return {
    id: String(input?.id ?? ''),
    name: String(input?.name ?? ''),
    department: input?.department ?? null,
    status: String(input?.status ?? 'UNKNOWN'),
  }
}

export async function createPerson(input: { name: string; department?: string | null }) {
  const res = await api.post('/people', input)
  return normalizePerson(res.data)
}

export async function getPersonById(id: string) {
  const res = await api.get(`/people/${id}`)
  return normalizePerson(res.data)
}
