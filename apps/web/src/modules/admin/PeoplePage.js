import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useExecutiveDashboard } from '../../hooks/useExecutiveDashboard';
export default function PeoplePage() {
    const { loading, people } = useExecutiveDashboard();
    if (loading) {
        return _jsx("div", { className: "p-6", children: "Carregando..." });
    }
    return (_jsxs("div", { className: "p-6 space-y-4", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Pessoas" }), _jsx("div", { className: "space-y-3", children: people.map(p => (_jsxs("div", { className: "border rounded p-4 flex justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: p.name }), _jsx("div", { className: "text-sm opacity-70", children: p.department ?? '—' })] }), _jsx(StatusBadge, { status: p.status })] }, p.id))) })] }));
}
function StatusBadge({ status }) {
    const color = status === 'CRITICAL'
        ? 'text-red-600'
        : status === 'WARNING'
            ? 'text-yellow-600'
            : status === 'RESTRICTED'
                ? 'text-orange-600'
                : status === 'SUSPENDED'
                    ? 'text-red-800'
                    : 'text-green-600';
    return (_jsx("span", { className: `text-sm font-semibold ${color}`, children: status }));
}
