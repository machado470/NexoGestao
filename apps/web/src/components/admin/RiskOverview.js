import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import Card from '../base/Card';
import StatusBadge from '../base/StatusBadge';
const LEVEL_LABEL = {
    LOW: 'Baixo',
    MEDIUM: 'Médio',
    HIGH: 'Alto',
    CRITICAL: 'Crítico',
};
export default function RiskOverview({ riskByLevel }) {
    return (_jsx("div", { className: "grid grid-cols-1 md:grid-cols-4 gap-6", children: Object.keys(riskByLevel).map(level => (_jsx(Card, { children: _jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { children: [_jsxs("p", { className: "text-sm text-slate-400", children: ["Risco ", LEVEL_LABEL[level]] }), _jsx("p", { className: "text-3xl font-semibold mt-2", children: riskByLevel[level] })] }), _jsx(StatusBadge, { label: LEVEL_LABEL[level], tone: level })] }) }, level))) }));
}
