import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import StatusBadge from '../../components/base/StatusBadge';
import CollaboratorShell from '../../layouts/CollaboratorShell';
import { getMe } from '../../services/me';
import { startAssignment } from '../../services/assignments';
import { useTheme } from '../../theme/ThemeProvider';
export default function CollaboratorDashboard() {
    const navigate = useNavigate();
    const { styles } = useTheme();
    const [loading, setLoading] = useState(true);
    const [assignments, setAssignments] = useState([]);
    const [operational, setOperational] = useState({ state: 'NORMAL' });
    async function load() {
        setLoading(true);
        const data = await getMe();
        setAssignments(data.assignments ?? []);
        setOperational(data.operational);
        setLoading(false);
    }
    useEffect(() => {
        load();
    }, []);
    if (loading) {
        return (_jsx(CollaboratorShell, { children: _jsx("p", { className: `text-sm ${styles.textMuted}`, children: "Carregando\u2026" }) }));
    }
    const canAct = operational.state === 'NORMAL';
    return (_jsxs(CollaboratorShell, { children: [_jsx(PageHeader, { title: "Meu painel", description: "Suas trilhas e estado operacional" }), _jsx(Card, { className: "mb-4", children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("span", { className: `text-sm block ${styles.textMuted}`, children: "Estado operacional" }), operational.reason && (_jsx("span", { className: `text-xs ${styles.textMuted} opacity-80`, children: operational.reason }))] }), _jsx(StatusBadge, { label: operational.state, tone: operational.state === 'NORMAL'
                                ? 'success'
                                : operational.state === 'RESTRICTED'
                                    ? 'warning'
                                    : 'critical' })] }) }), _jsx("div", { className: "mb-6", children: _jsx("button", { onClick: () => navigate('/collaborator/timeline'), className: `text-xs underline ${styles.accent} opacity-90 hover:opacity-100`, children: "Ver hist\u00F3rico de a\u00E7\u00F5es" }) }), _jsxs("div", { className: "space-y-4", children: [_jsx("h3", { className: "text-sm font-semibold opacity-70", children: "Trilhas atribu\u00EDdas" }), assignments.length === 0 && (_jsx("p", { className: `text-sm ${styles.textMuted} opacity-80`, children: "Nenhuma trilha atribu\u00EDda no momento." })), assignments.map(a => (_jsxs(Card, { children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("span", { className: "font-medium", children: a.track.title }), _jsxs("span", { className: `text-xs ${styles.textMuted}`, children: [a.progress, "%"] })] }), _jsx("div", { className: "w-full h-2 bg-white/10 rounded overflow-hidden mb-3", children: _jsx("div", { className: "h-2 bg-[#F97316] transition-all", style: { width: `${a.progress}%` } }) }), a.status === 'NOT_STARTED' && canAct && (_jsx("button", { onClick: async () => {
                                    await startAssignment(a.id);
                                    load();
                                }, className: `text-xs px-3 py-1 rounded ${styles.buttonPrimary}`, children: "Iniciar trilha" })), a.status === 'IN_PROGRESS' && canAct && (_jsx("button", { onClick: () => navigate(`/collaborator/assessment/${a.id}`), className: "text-xs px-3 py-1 rounded bg-amber-600 text-white hover:bg-amber-500", children: "Realizar avalia\u00E7\u00E3o" })), !canAct && (_jsx("p", { className: "text-xs text-amber-400", children: "A\u00E7\u00F5es bloqueadas pelo estado operacional" })), a.status === 'COMPLETED' && (_jsx("p", { className: "text-xs text-green-400", children: "Trilha conclu\u00EDda" }))] }, a.id)))] })] }));
}
