import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import api from '../../services/api';
export default function AuditLog() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        api.get('/audit')
            .then(res => setLogs(res.data))
            .finally(() => setLoading(false));
    }, []);
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Auditoria do Sistema" }), loading && (_jsx("div", { className: "text-zinc-400", children: "Carregando auditoria..." })), !loading && logs.length === 0 && (_jsx("div", { className: "text-zinc-400", children: "Nenhum evento registrado" })), _jsx("div", { className: "space-y-3", children: logs.map(log => (_jsxs("div", { className: "p-4 rounded border border-zinc-800", children: [_jsxs("div", { className: "font-semibold", children: [log.entity.toUpperCase(), " \u2014 ", log.action] }), _jsx("div", { className: "text-sm text-zinc-400", children: new Date(log.createdAt).toLocaleString() }), log.meta !== undefined && (_jsx("pre", { className: "mt-2 text-xs text-zinc-400", children: JSON.stringify(log.meta, null, 2) }))] }, log.id))) })] }));
}
