import { jsx as _jsx } from "react/jsx-runtime";
const styles = {
    success: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    critical: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    neutral: 'bg-white/10 text-slate-300 border-white/20',
};
function mapTone(input) {
    const v = input.toUpperCase();
    if (v === 'SUCCESS')
        return 'success';
    if (v === 'WARNING')
        return 'warning';
    if (v === 'CRITICAL')
        return 'critical';
    if (v === 'NEUTRAL')
        return 'neutral';
    switch (v) {
        case 'LOW':
        case 'NORMAL':
            return 'success';
        case 'MEDIUM':
        case 'RESTRICTED':
            return 'warning';
        case 'HIGH':
        case 'CRITICAL':
        case 'SUSPENDED':
            return 'critical';
        default:
            return 'neutral';
    }
}
export default function StatusBadge({ label, tone = 'neutral', }) {
    const resolvedTone = mapTone(tone);
    return (_jsx("span", { className: `
        inline-flex items-center
        rounded-full
        border
        px-3 py-1
        text-xs font-medium
        ${styles[resolvedTone]}
      `, children: label }));
}
