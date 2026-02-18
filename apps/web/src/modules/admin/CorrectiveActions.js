import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useParams } from 'react-router-dom';
import { useState } from 'react';
import Card from '../../components/base/Card';
import PageHeader from '../../components/base/PageHeader';
import StatusBadge from '../../components/base/StatusBadge';
import ConfirmDialog from '../../components/base/ConfirmDialog';
import api from '../../services/api';
import { useCorrectiveActions } from '../../hooks/useCorrectiveActions';
import { usePersonDetail } from '../../hooks/usePersonDetail';
import { useMe } from '../../hooks/useMe';
export default function CorrectiveActions() {
    const { personId } = useParams();
    const { me } = useMe();
    const { actions, loading, reload } = useCorrectiveActions(personId);
    const { loading: personLoading } = usePersonDetail(personId);
    const [confirm, setConfirm] = useState(null);
    const [actionLoading, setActionLoading] = useState(false);
    const operationalState = me?.operationalState?.state ?? 'NORMAL';
    const blocked = operationalState !== 'NORMAL';
    if (loading || personLoading) {
        return (_jsx("div", { className: "text-sm opacity-60", children: "Carregando a\u00E7\u00F5es corretivas\u2026" }));
    }
    async function resolveAction(actionId) {
        if (!personId || blocked)
            return;
        setActionLoading(true);
        try {
            await api.post(`/corrective-actions/${actionId}/resolve`);
            await api.post(`/corrective-actions/person/${personId}/reassess`);
            await reload();
        }
        finally {
            setActionLoading(false);
            setConfirm(null);
        }
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx(PageHeader, { title: "A\u00E7\u00F5es corretivas", description: "Interven\u00E7\u00F5es institucionais ativas" }), blocked && (_jsx(Card, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: "A\u00E7\u00F5es bloqueadas" }), _jsxs("div", { className: "text-sm opacity-70 mt-1", children: ["Estado operacional atual:", ' ', _jsx("strong", { children: operationalState })] })] }), _jsx(StatusBadge, { label: operationalState, tone: "warning" })] }) })), actions.length === 0 ? (_jsx(Card, { children: _jsx("div", { className: "text-sm text-slate-400", children: "Nenhuma a\u00E7\u00E3o corretiva ativa." }) })) : (actions.map(action => (_jsx(Card, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: "A\u00E7\u00E3o corretiva institucional" }), _jsxs("div", { className: "text-xs opacity-60 mt-1", children: ["Criada em", ' ', new Date(action.createdAt).toLocaleString()] })] }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(StatusBadge, { label: action.status, tone: action.status === 'OPEN'
                                        ? 'critical'
                                        : action.status ===
                                            'AWAITING_REASSESSMENT'
                                            ? 'warning'
                                            : 'success' }), action.status === 'OPEN' && (_jsx("button", { disabled: actionLoading || blocked, onClick: () => setConfirm({
                                        id: action.id,
                                    }), className: `
                      text-sm px-4 py-2 rounded-lg
                      ${blocked
                                        ? 'bg-slate-600/10 text-slate-400 cursor-not-allowed'
                                        : 'bg-emerald-500/10 text-emerald-400'}
                    `, children: "Resolver" }))] })] }) }, action.id)))), confirm && (_jsx(ConfirmDialog, { title: "Resolver a\u00E7\u00E3o corretiva", description: "Esta a\u00E7\u00E3o exigir\u00E1 reavalia\u00E7\u00E3o autom\u00E1tica.", onCancel: () => setConfirm(null), onConfirm: () => resolveAction(confirm.id), loading: actionLoading }))] }));
}
