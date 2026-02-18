import api from './api';
/**
 * 📜 Timeline global (admin)
 */
export async function getGlobalTimeline() {
    const { data } = await api.get('/timeline');
    return data;
}
/**
 * 👤 Timeline por pessoa (admin / detalhe)
 */
export async function getPersonTimeline(personId) {
    const { data } = await api.get(`/timeline/person/${personId}`);
    return data;
}
