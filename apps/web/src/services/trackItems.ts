import api from './api'

export type TrackItemType =
  | 'READING'
  | 'ACTION'
  | 'CHECKPOINT'

export type TrackItem = {
  id: string
  trackId: string
  title: string
  content?: string | null
  type: TrackItemType
  order: number
  createdAt: string
}

/**
 * 📋 Lista itens de uma trilha (ordenados)
 * Backend: GET /track-items/track/:trackId
 */
export async function listTrackItems(
  trackId: string,
): Promise<TrackItem[]> {
  const { data } = await api.get(
    `/track-items/track/${trackId}`,
  )
  return data
}

/**
 * ➕ Cria item da trilha (somente DRAFT)
 * Backend: POST /track-items/track/:trackId
 */
export async function createTrackItem(
  trackId: string,
  params: {
    title: string
    content?: string
    type: TrackItemType
  },
) {
  const { data } = await api.post(
    `/track-items/track/${trackId}`,
    params,
  )
  return data
}

/**
 * ✏️ Atualiza item da trilha (somente DRAFT)
 * Backend: PATCH /track-items/:itemId
 */
export async function updateTrackItem(
  itemId: string,
  params: {
    title?: string
    content?: string
  },
) {
  const { data } = await api.patch(
    `/track-items/${itemId}`,
    params,
  )
  return data
}

/**
 * ❌ Remove item da trilha (somente DRAFT)
 * Backend: DELETE /track-items/:itemId
 */
export async function removeTrackItem(
  itemId: string,
) {
  const { data } = await api.delete(
    `/track-items/${itemId}`,
  )
  return data
}
