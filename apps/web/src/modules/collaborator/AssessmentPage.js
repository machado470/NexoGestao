import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import CollaboratorShell from '../../layouts/CollaboratorShell';
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import { getMe } from '../../services/me';
import { submitAssessment } from '../../services/assessments';
import { useTheme } from '../../theme/useTheme';
export default function AssessmentPage() {
    const { styles } = useTheme();
    const { assignmentId } = useParams();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [assignment, setAssignment] = useState(null);
    const [score, setScore] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    useEffect(() => {
        if (!assignmentId) {
            navigate('/app', { replace: true });
            return;
        }
        getMe()
            .then((data) => {
            const found = data.assignments.find(a => a.id === assignmentId);
            if (!found || found.status !== 'IN_PROGRESS') {
                navigate('/app', { replace: true });
                return;
            }
            setAssignment(found);
        })
            .finally(() => setLoading(false));
    }, [assignmentId, navigate]);
    async function handleSubmit() {
        if (!assignment)
            return;
        if (score < 0 || score > 100)
            return;
        setSubmitting(true);
        await submitAssessment({
            assignmentId: assignment.id,
            score,
        });
        navigate('/app', { replace: true });
    }
    if (loading || !assignment) {
        return (_jsx(CollaboratorShell, { children: _jsx("p", { className: `text-sm ${styles.textMuted}`, children: "Carregando\u2026" }) }));
    }
    return (_jsxs(CollaboratorShell, { children: [_jsx(PageHeader, { title: "Avalia\u00E7\u00E3o obrigat\u00F3ria", description: `Trilha: ${assignment.track.title}` }), _jsx(Card, { children: _jsxs("div", { className: "space-y-4", children: [_jsx("p", { className: "text-sm opacity-70", children: "Informe sua pontua\u00E7\u00E3o final (0 a 100)." }), _jsx("input", { type: "number", min: 0, max: 100, value: score, onChange: e => setScore(Number(e.target.value)), className: "w-full px-3 py-2 rounded bg-white/10 border border-white/20" }), _jsx("button", { disabled: submitting, onClick: handleSubmit, className: `w-full py-2 rounded disabled:opacity-50 ${styles.buttonPrimary}`, children: submitting ? 'Enviando…' : 'Enviar avaliação' })] }) })] }));
}
