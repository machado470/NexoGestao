import api from './api';
export async function listMyAssignments() {
    const res = await api.get('/assignments/my');
    return res.data;
}
export async function startAssignment(id) {
    const res = await api.post(`/assignments/${id}/start`);
    return res.data;
}
export async function completeAssignment(id) {
    const res = await api.post(`/assignments/${id}/complete`);
    return res.data;
}
