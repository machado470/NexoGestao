import api from './api';
export async function getCorrectiveActionsByPerson(personId) {
    const res = await api.get(`/corrective-actions/person/${personId}`);
    return res.data;
}
export async function createCorrectiveAction(personId, reason) {
    const res = await api.post('/corrective-actions', {
        personId,
        reason,
    });
    return res.data;
}
export async function resolveCorrectiveAction(correctiveActionId) {
    const res = await api.post(`/corrective-actions/${correctiveActionId}/resolve`);
    return res.data;
}
