import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
export default function Pending() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    async function load() {
        setLoading(true);
        const res = await api.get('/reports/pending');
        setItems(res.data.data);
        setLoading(false);
    }
    useEffect(() => {
        load();
    }, []);
    if (loading) {
        return (_jsx("div", { className: "text-slate-400", children: "Carregando pend\u00EAncias\u2026" }));
    }
    return (_jsxs("div", { className: "space-y-6", children: [_jsx("h1", { className: "text-2xl font-bold", children: "Pend\u00EAncias" }), items.length === 0 ? (_jsx("div", { className: "bg-slate-900 rounded p-6 text-slate-400", children: "Nenhuma pend\u00EAncia no momento." })) : (_jsx("div", { className: "bg-slate-900 rounded divide-y divide-slate-800", children: items.map(p => (_jsx(Link, { to: `/admin/persons/${p.personId}`, className: "block px-4 py-3 hover:bg-slate-800", children: _jsxs("div", { className: "flex justify-between items-center", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: p.personName }), _jsx("div", { className: "text-sm text-slate-400", children: p.reason })] }), _jsx("span", { className: p.risk === 'CRITICAL'
                                    ? 'text-red-400'
                                    : 'text-yellow-400', children: p.risk })] }) }, p.actionId))) }))] }));
}
