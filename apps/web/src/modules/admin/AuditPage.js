import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import Card from '../../components/base/Card';
import PageHeader from '../../components/base/PageHeader';
import SectionBase from '../../components/layout/SectionBase';
import StatusBadge from '../../components/base/StatusBadge';
import EmptyState from '../../components/base/EmptyState';
import api from '../../services/api';
export default function AuditPage() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [events, setEvents] = useState([]);
    useEffect(() => {
        let mounted = true;
        setLoading(true);
        setError(null);
        api
            .get('/audit')
            .then(res => {
            if (!mounted)
                return;
            setEvents(res.data?.data ?? []);
        })
            .catch(() => {
            if (!mounted)
                return;
            setError('Não foi possível carregar a auditoria.');
        })
            .finally(() => {
            if (!mounted)
                return;
            setLoading(false);
        });
        return () => {
            mounted = false;
        };
    }, []);
    return (_jsxs(SectionBase, { children: [_jsx(PageHeader, { title: "Auditoria", description: "Evid\u00EAncias institucionais e hist\u00F3rico de decis\u00F5es." }), _jsx(Card, { className: "mt-6", children: loading ? (_jsx("div", { className: "text-sm opacity-60", children: "Carregando auditoria\u2026" })) : error ? (_jsx("div", { className: "text-sm text-red-500", children: error })) : events.length === 0 ? (_jsx(EmptyState, { title: "Nenhum evento registrado", description: "As decis\u00F5es institucionais aparecer\u00E3o aqui." })) : (_jsx("div", { className: "space-y-3", children: events.map(e => (_jsx("div", { className: "\n                  p-3 rounded-lg\n                  border border-white/10\n                ", children: _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium truncate", children: e.action }), e.person?.name && (_jsxs("div", { className: "text-xs opacity-70 mt-1", children: ["Pessoa: ", e.person.name] })), _jsx("div", { className: "text-xs opacity-60 mt-1", children: new Date(e.createdAt).toLocaleString() }), e.context && (_jsx("div", { className: "text-xs opacity-60 mt-1", children: e.context }))] }), _jsx(StatusBadge, { label: "Registro", tone: "neutral" })] }) }, e.id))) })) })] }));
}
