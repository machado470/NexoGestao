import api from './api';
// ✅ endpoint real na API: GET /reports/executive-report
export async function getExecutiveReport() {
    const res = await api.get('/reports/executive-report');
    return res.data;
}
// ✅ endpoint real na API: GET /reports/metrics?days=30
export async function getExecutiveMetrics(days = 30) {
    const res = await api.get('/reports/metrics', { params: { days } });
    return res.data;
}
