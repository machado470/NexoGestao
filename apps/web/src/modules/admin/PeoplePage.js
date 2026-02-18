import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { useExecutiveDashboard } from '../../hooks/useExecutiveDashboard';
export default function PeoplePage() {
    const { loading, people } = useExecutiveDashboard();
    if (loading)
        return _jsx("div", { className: "p-6", children: "Carregando..." });
    return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Pessoas" }), _jsx(Link, { to: "/admin/pessoas/nova", className: "border rounded px-3 py-2 text-sm", children: "Nova pessoa" })] }), _jsxs("div", { className: "space-y-2", children: [people.map(p => (_jsx(Link, { to: `/admin/pessoas/${p.id}`, className: "block border rounded p-3 hover:bg-black/5", children: _jsxs("div", { className: "flex items-start justify-between gap-4", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-medium truncate", children: p.name }), _jsx("div", { className: "text-sm opacity-70 truncate", children: p.reason ?? '—' })] }), _jsxs("div", { className: "text-sm font-semibold whitespace-nowrap", children: [p.status, " (", p.riskScore, ")"] })] }) }, p.id))), people.length === 0 && (_jsx("div", { className: "border rounded p-4 opacity-70", children: "Nenhuma pessoa encontrada." }))] })] }));
}
