import api from './api';
/**
 * 📋 Lista assignments abertos de uma pessoa
 * Backend: GET /assignments/person/:personId
 */
export async function listAssignmentsByPerson(personId) {
    const res = await api.get(`/assignments/person/${personId}`);
    return res.data;
}
/**
 * ▶️ Inicia assignment (progress 0 → 1)
 * Backend: POST /assignments/:id/start
 */
export async function startPersonAssignment(assignmentId) {
    const res = await api.post(`/assignments/${assignmentId}/start`);
    return res.data;
}
/**
 * 🔄 Atualiza progresso (1..99)
 * Backend: PATCH /assignments/:id/progress
 */
export async function updatePersonAssignmentProgress(assignmentId, progress) {
    const res = await api.patch(`/assignments/${assignmentId}/progress`, { progress });
    return res.data;
}
