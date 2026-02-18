import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import Card from './Card';
export default function StatCard({ label, value, colorClass, }) {
    return (_jsxs(Card, { children: [_jsx("div", { className: "text-sm opacity-70", children: label }), _jsx("div", { className: `mt-2 text-3xl font-semibold ${colorClass ?? ''}`, children: value })] }));
}
