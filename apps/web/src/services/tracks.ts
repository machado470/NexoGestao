import api from './api'

export type TrackStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED'

export type TrackListItem = {
  id: string
  title: string
  description?: string | null
  status: TrackStatus
  version: number
  peopleCount: number
  completionRate: number
}

export type TrackAssignment = {
  id: string
  personId: string
  trackId: string
  progress: number
  createdAt: string
  updatedAt: string
  person?: {
    id: string
    name: string
    email?: string | null
    role: string
    active: boolean
  }
}

export type TrackDetail = {
  id: string
  title: string
  description?: string | null
  slug: string
  version: number
  status: TrackStatus
  createdAt: string
  assignments: TrackAssignment[]
}

export async function getTracks(): Promise<TrackListItem[]> {
  const { data } = await api.get('/tracks')
  return data
}

export async function getTrack(id: string): Promise<TrackDetail> {
  const { data } = await api.get(`/tracks/${id}`)
  return data
}

export async function createTrack(params: {
  title: string
  description?: string
}) {
  const { data } = await api.post('/tracks', params)
  return data
}

export async function updateTrack(
  id: string,
  params: { title?: string; description?: string },
) {
  const { data } = await api.patch(`/tracks/${id}`, params)
  return data
}

export async function publishTrack(id: string) {
  const { data } = await api.post(`/tracks/${id}/publish`)
  return data
}

export async function archiveTrack(id: string) {
  const { data } = await api.post(`/tracks/${id}/archive`)
  return data
}

export async function assignPeopleToTrack(params: {
  trackId: string
  personIds: string[]
}) {
  const { trackId, personIds } = params
  const { data } = await api.post(`/tracks/${trackId}/assign`, {
    personIds,
  })
  return data
}

export async function unassignPeopleFromTrack(params: {
  trackId: string
  personIds: string[]
}) {
  const { trackId, personIds } = params
  const { data } = await api.post(`/tracks/${trackId}/unassign`, {
    personIds,
  })
  return data
}
