import api from './api';
export async function getPersonOverview(personId) {
    const { data } = await api.get(`/people/${personId}/overview`);
    return data;
}
