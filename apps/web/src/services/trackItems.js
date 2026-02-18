import api from './api';
/**
 * 📋 Lista itens de uma trilha (ordenados)
 * Backend: GET /track-items/track/:trackId
 */
export async function listTrackItems(trackId) {
    const { data } = await api.get(`/track-items/track/${trackId}`);
    return data;
}
/**
 * ➕ Cria item da trilha (somente DRAFT)
 * Backend: POST /track-items/track/:trackId
 */
export async function createTrackItem(trackId, params) {
    const { data } = await api.post(`/track-items/track/${trackId}`, params);
    return data;
}
/**
 * ✏️ Atualiza item da trilha (somente DRAFT)
 * Backend: PATCH /track-items/:itemId
 */
export async function updateTrackItem(itemId, params) {
    const { data } = await api.patch(`/track-items/${itemId}`, params);
    return data;
}
/**
 * ❌ Remove item da trilha (somente DRAFT)
 * Backend: DELETE /track-items/:itemId
 */
export async function removeTrackItem(itemId) {
    const { data } = await api.delete(`/track-items/${itemId}`);
    return data;
}
