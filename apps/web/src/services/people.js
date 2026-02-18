import api from './api';
function normalizePerson(input) {
    return {
        id: String(input?.id ?? ''),
        name: String(input?.name ?? ''),
        department: input?.department ?? null,
        status: String(input?.status ?? 'UNKNOWN'),
    };
}
export async function createPerson(input) {
    const res = await api.post('/people', input);
    return normalizePerson(res.data);
}
export async function getPersonById(id) {
    const res = await api.get(`/people/${id}`);
    return normalizePerson(res.data);
}
