import api from './api';
export async function getTracks() {
    const { data } = await api.get('/tracks');
    return data;
}
export async function getTrack(id) {
    const { data } = await api.get(`/tracks/${id}`);
    return data;
}
export async function createTrack(params) {
    const { data } = await api.post('/tracks', params);
    return data;
}
export async function updateTrack(id, params) {
    const { data } = await api.patch(`/tracks/${id}`, params);
    return data;
}
export async function publishTrack(id) {
    const { data } = await api.post(`/tracks/${id}/publish`);
    return data;
}
export async function archiveTrack(id) {
    const { data } = await api.post(`/tracks/${id}/archive`);
    return data;
}
export async function assignPeopleToTrack(params) {
    const { trackId, personIds } = params;
    const { data } = await api.post(`/tracks/${trackId}/assign`, {
        personIds,
    });
    return data;
}
export async function unassignPeopleFromTrack(params) {
    const { trackId, personIds } = params;
    const { data } = await api.post(`/tracks/${trackId}/unassign`, {
        personIds,
    });
    return data;
}
