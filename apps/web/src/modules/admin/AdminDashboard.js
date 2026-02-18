import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useExecutiveDashboard } from '../../hooks/useExecutiveDashboard';
export default function AdminDashboard() {
    const { loading, peopleStats, correctiveOpenCount, people } = useExecutiveDashboard();
    if (loading) {
        return _jsx("div", { className: "p-6", children: "Carregando..." });
    }
    const totalAtRisk = peopleStats.WARNING +
        peopleStats.RESTRICTED +
        peopleStats.SUSPENDED +
        peopleStats.CRITICAL;
    return (_jsxs("div", { className: "p-6 space-y-6", children: [_jsx("h1", { className: "text-2xl font-semibold", children: "Executive Dashboard" }), _jsxs("div", { className: "grid grid-cols-2 md:grid-cols-3 gap-4", children: [_jsx(Card, { title: "Total", children: peopleStats.total }), _jsx(Card, { title: "Normais", children: peopleStats.NORMAL }), _jsx(Card, { title: "Em Risco", children: totalAtRisk }), _jsx(Card, { title: "Corretivas Abertas", children: correctiveOpenCount })] }), _jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold mb-2", children: "Pessoas" }), _jsx("div", { className: "space-y-2", children: people.map(p => (_jsxs("div", { className: "border rounded p-3 flex justify-between", children: [_jsxs("div", { children: [_jsx("div", { className: "font-medium", children: p.name }), _jsx("div", { className: "text-sm opacity-70", children: p.department ?? '—' })] }), _jsxs("div", { className: "text-sm font-medium", children: [p.status, " (", p.riskScore, ")"] })] }, p.id))) })] })] }));
}
function Card({ title, children }) {
    return (_jsxs("div", { className: "border rounded p-4", children: [_jsx("div", { className: "text-sm opacity-70", children: title }), _jsx("div", { className: "text-xl font-semibold", children: children })] }));
}
