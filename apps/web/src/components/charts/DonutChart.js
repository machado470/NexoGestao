import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from '../../theme/useTheme';
export function DonutChart({ title, slices }) {
    const { styles } = useTheme();
    const total = slices.reduce((acc, s) => acc + s.value, 0);
    if (!total) {
        return _jsx("div", { className: styles.muted, children: "Sem dados" });
    }
    let offset = 25;
    const colors = [
        styles.chart.success,
        styles.chart.warning,
        styles.chart.danger,
        styles.chart.primary,
    ];
    return (_jsxs("div", { className: "flex items-center gap-6", children: [_jsxs("svg", { viewBox: "0 0 42 42", className: "w-32 h-32", children: [_jsx("circle", { cx: "21", cy: "21", r: "15.9", fill: "transparent", stroke: "currentColor", strokeOpacity: "0.1", strokeWidth: "3" }), slices.map((slice, i) => {
                        const percentage = (slice.value / total) * 100;
                        const stroke = colors[i % colors.length];
                        const circle = (_jsx("circle", { cx: "21", cy: "21", r: "15.9", fill: "transparent", stroke: stroke, strokeWidth: "3", strokeDasharray: `${percentage} ${100 - percentage}`, strokeDashoffset: offset }, slice.label));
                        offset -= percentage;
                        return circle;
                    })] }), _jsxs("div", { className: "space-y-2 text-sm", children: [title && (_jsx("div", { className: `font-medium ${styles.muted}`, children: title })), slices.map((slice, i) => (_jsxs("div", { className: "flex items-center gap-3 opacity-80", children: [_jsx("span", { className: "w-2 h-2 rounded-full", style: {
                                    backgroundColor: colors[i % colors.length],
                                } }), _jsx("span", { className: "flex-1", children: slice.label }), _jsxs("span", { className: "font-medium", children: [slice.value, "%"] })] }, slice.label)))] })] }));
}
