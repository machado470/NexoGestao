import api from './api';
export async function getExecutiveReport() {
    const res = await api.get('/reports/executive');
    return res.data;
}
export async function getExecutiveMetrics(days = 30) {
    const res = await api.get('/reports/executive/metrics', {
        params: { days },
    });
    return res.data;
}
