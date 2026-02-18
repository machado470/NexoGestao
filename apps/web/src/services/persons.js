import api from './api';
export async function listPeople() {
    const res = await api.get('/people');
    return res.data;
}
export async function createPerson(data) {
    const res = await api.post('/people', data);
    return res.data;
}
