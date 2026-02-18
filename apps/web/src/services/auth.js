import api from './api';
export async function activateAccount(input) {
    const { data } = await api.post('/auth/activate', input);
    return data;
}
