import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import SectionBase from '../../components/layout/SectionBase';
import { submitAssessment } from '../../services/assessments';
import { useTheme } from '../../theme/ThemeProvider';
export default function EvaluationsPage() {
    const { styles } = useTheme();
    const [searchParams] = useSearchParams();
    const prefilledAssignmentId = searchParams.get('assignmentId') ?? '';
    const [assignmentId, setAssignmentId] = useState('');
    const [score, setScore] = useState(80);
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState(null);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (prefilledAssignmentId) {
            setAssignmentId(prefilledAssignmentId);
        }
    }, [prefilledAssignmentId]);
    async function submit() {
        if (!assignmentId) {
            setError('Informe o ID da atribuição');
            return;
        }
        setSubmitting(true);
        setError(null);
        setSuccess(null);
        try {
            await submitAssessment({ assignmentId, score });
            setSuccess('Avaliação registrada com sucesso');
            setAssignmentId('');
        }
        catch {
            setError('Erro ao registrar avaliação');
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsxs(SectionBase, { children: [_jsx(PageHeader, { title: "Avalia\u00E7\u00F5es", description: "Registrar avalia\u00E7\u00E3o e impacto no risco" }), _jsx(Card, { className: "max-w-xl", children: _jsxs("div", { className: "space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm opacity-60", children: "Assignment ID" }), _jsx("input", { value: assignmentId, onChange: e => setAssignmentId(e.target.value), className: "w-full mt-1 rounded bg-slate-900 border border-slate-700 px-3 py-2 text-sm" })] }), _jsxs("div", { children: [_jsxs("label", { className: "text-sm opacity-60", children: ["Score (", score, ")"] }), _jsx("input", { type: "range", min: 0, max: 100, value: score, onChange: e => setScore(Number(e.target.value)), className: "w-full" })] }), error && _jsx("p", { className: "text-sm text-red-400", children: error }), success && _jsx("p", { className: "text-sm text-emerald-400", children: success }), _jsx("button", { disabled: submitting, onClick: submit, className: `rounded px-4 py-2 text-sm disabled:opacity-50 ${styles.buttonPrimary}`, children: submitting ? 'Enviando…' : 'Registrar avaliação' })] }) })] }));
}
