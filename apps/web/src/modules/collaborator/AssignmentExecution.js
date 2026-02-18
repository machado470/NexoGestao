import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import PageHeader from '../../components/base/PageHeader';
import Card from '../../components/base/Card';
import ProgressBar from '../../components/base/ProgressBar';
import SectionBase from '../../components/layout/SectionBase';
export default function AssignmentExecution() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [item, setItem] = useState(null);
    const [progress, setProgress] = useState(0);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const loadNext = useCallback(async () => {
        if (!id)
            return;
        const { data } = await api.get(`/assignments/${id}/next-item`);
        if (!data) {
            navigate('/collaborator');
            return;
        }
        setItem(data);
        setLoading(false);
    }, [id, navigate]);
    const start = useCallback(async () => {
        if (!id)
            return;
        await api.post(`/assignments/${id}/start`);
        await loadNext();
    }, [id, loadNext]);
    async function completeItem() {
        if (!id || !item)
            return;
        setBusy(true);
        const { data } = await api.post(`/assignments/${id}/complete-item`, { itemId: item.id });
        setProgress(data.progress);
        setBusy(false);
        if (data.finished) {
            navigate('/collaborator');
        }
        else {
            await loadNext();
        }
    }
    useEffect(() => {
        start();
    }, [start]);
    if (loading || !item) {
        return (_jsxs(SectionBase, { children: [_jsx(PageHeader, { title: "Execu\u00E7\u00E3o da trilha" }), _jsx("p", { className: "opacity-60 mt-6", children: "Preparando pr\u00F3ximo passo\u2026" })] }));
    }
    return (_jsxs(SectionBase, { children: [_jsx(PageHeader, { title: item.title, description: `Etapa ${item.order}` }), _jsxs(Card, { children: [_jsx(ProgressBar, { value: progress }), _jsxs("div", { className: "mt-6 space-y-4", children: [item.type === 'READING' && (_jsx("div", { className: "text-sm leading-relaxed opacity-80", children: item.content ?? 'Conteúdo de leitura não informado.' })), item.type === 'ACTION' && (_jsx("div", { className: "text-sm opacity-80", children: "Execute a a\u00E7\u00E3o descrita e confirme quando finalizar." })), item.type === 'CHECKPOINT' && (_jsx("div", { className: "text-sm opacity-80", children: "Confirme que voc\u00EA compreendeu e concluiu este ponto." })), _jsx("button", { disabled: busy, onClick: completeItem, className: "mt-4 px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-40", children: "Concluir etapa" })] })] })] }));
}
