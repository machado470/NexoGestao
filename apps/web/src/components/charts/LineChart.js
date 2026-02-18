import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from '../../theme/useTheme';
export function LineChart({ title, data, labels }) {
    const { styles } = useTheme();
    if (!data || data.length === 0) {
        return _jsx("div", { className: styles.muted, children: "Sem dados" });
    }
    const max = Math.max(...data);
    const points = data
        .map((value, index) => {
        const x = (index / (data.length - 1)) * 100;
        const y = 40 - (value / max) * 32 - 2;
        return `${x},${y}`;
    })
        .join(' ');
    return (_jsxs("div", { className: "space-y-3", children: [title && (_jsx("h3", { className: `text-sm font-medium ${styles.muted}`, children: title })), _jsxs("svg", { viewBox: "0 0 100 40", className: "w-full h-28", children: [_jsx("line", { x1: "0", y1: "38", x2: "100", y2: "38", stroke: "currentColor", strokeOpacity: "0.1" }), _jsx("polyline", { fill: "none", stroke: styles.chart.primary, strokeWidth: "1.5", strokeLinejoin: "round", strokeLinecap: "round", points: points })] }), _jsx("div", { className: `
          flex
          justify-between
          text-xs
          ${styles.muted}
          opacity-70
        `, children: labels.map(label => (_jsx("span", { children: label }, label))) })] }));
}
