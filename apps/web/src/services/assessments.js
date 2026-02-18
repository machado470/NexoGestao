import api from './api';
export async function submitAssessment(params) {
    await api.post('/assessments', params);
}
