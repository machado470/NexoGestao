import api from './api'

export type MyAssignment = {
  id: string
  trackId: string
  trackTitle?: string
  progress: number
  status?: string
  createdAt?: string
}

function normalizeMyAssignments(payload: any): MyAssignment[] {
  // tentativas comuns (defensivo, porque /me pode variar)
  const list =
    payload?.myAssignments ??
    payload?.assignments ??
    payload?.data?.myAssignments ??
    payload?.data?.assignments ??
    payload?.me?.myAssignments ??
    payload?.me?.assignments ??
    payload?.user?.myAssignments ??
    payload?.user?.assignments

  if (!Array.isArray(list)) return []

  return list.map((a: any) => ({
    id: String(a.id),
    trackId: String(a.trackId ?? a.track?.id ?? ''),
    trackTitle: a.trackTitle ?? a.track?.title ?? undefined,
    progress: Number(a.progress ?? 0),
    status: a.status ?? undefined,
    createdAt: a.createdAt ?? undefined,
  }))
}

// ✅ lista vem de /me (AssignmentsService não expõe /assignments/my)
export async function listMyAssignments(): Promise<MyAssignment[]> {
  const res = await api.get('/me')
  return normalizeMyAssignments(res.data)
}

export async function startAssignment(id: string) {
  const res = await api.post(`/assignments/${id}/start`)
  return res.data
}

export async function getNextItem(assignmentId: string) {
  const res = await api.get(`/assignments/${assignmentId}/next-item`)
  return res.data
}

export async function completeItem(assignmentId: string, itemId: string) {
  const res = await api.post(`/assignments/${assignmentId}/complete-item`, { itemId })
  return res.data
}

export async function rebuildProgress(assignmentId: string) {
  const res = await api.post(`/assignments/${assignmentId}/rebuild-progress`)
  return res.data
}
