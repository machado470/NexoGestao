import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function actionTone(action) {
    if (action.includes('CRITICAL')) {
        return 'border-rose-500/40 text-rose-400';
    }
    if (action.includes('WARNING')) {
        return 'border-amber-500/40 text-amber-400';
    }
    if (action.includes('CREATED') || action.includes('STARTED')) {
        return 'border-[#F97316]/35 text-[#F97316]';
    }
    if (action.includes('COMPLETED') || action.includes('RESOLVED')) {
        return 'border-emerald-500/40 text-emerald-400';
    }
    return 'border-white/20 text-slate-300';
}
function humanizeAction(action) {
    return action
        .replaceAll('_', ' ')
        .toLowerCase()
        .replace(/^\w/, c => c.toUpperCase());
}
export default function EventTimeline({ events }) {
    if (!events || events.length === 0) {
        return (_jsx("div", { className: "text-sm text-slate-400", children: "Nenhum evento registrado." }));
    }
    return (_jsx("div", { className: "space-y-4", children: events.map(e => (_jsxs("div", { className: `
            rounded-xl
            border
            px-4 py-3
            ${actionTone(e.action)}
          `, children: [_jsxs("div", { className: "flex items-center justify-between mb-1", children: [_jsx("div", { className: "font-semibold text-sm", children: humanizeAction(e.action) }), _jsx("div", { className: "text-xs opacity-60", children: new Date(e.createdAt).toLocaleString() })] }), e.context && (_jsx("div", { className: "text-sm opacity-90", children: e.context })), e.personName && (_jsx("div", { className: "mt-1 text-xs opacity-60", children: e.personName }))] }, e.id))) }));
}
