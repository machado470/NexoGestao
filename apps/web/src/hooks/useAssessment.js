import { useState } from 'react';
import api from '../services/api';
function getErrorMessage(err) {
    if (typeof err !== 'object' || err === null) {
        return 'Erro ao enviar avaliação';
    }
    const anyErr = err;
    return (anyErr.response?.data?.error?.message ??
        anyErr.message ??
        'Erro ao enviar avaliação');
}
export default function useAssessment() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    async function submitAssessment(params) {
        try {
            setLoading(true);
            setError(null);
            const res = await api.post('/assessments', params);
            return res.data.data;
        }
        catch (err) {
            setError(getErrorMessage(err));
            throw err;
        }
        finally {
            setLoading(false);
        }
    }
    return {
        submitAssessment,
        loading,
        error,
    };
}
