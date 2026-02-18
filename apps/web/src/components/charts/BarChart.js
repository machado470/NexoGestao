import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from '../../theme/useTheme';
export function BarChart({ title, bars }) {
    const { styles } = useTheme();
    if (!bars || bars.length === 0) {
        return _jsx("div", { className: styles.muted, children: "Sem dados" });
    }
    return (_jsxs("div", { className: "space-y-4", children: [title && (_jsx("h3", { className: `text-sm font-medium ${styles.muted}`, children: title })), bars.map(bar => (_jsxs("div", { className: "space-y-1", children: [_jsxs("div", { className: "flex justify-between text-sm", children: [_jsx("span", { children: bar.label }), _jsxs("span", { children: [bar.value, "%"] })] }), _jsx("div", { className: `h-2 rounded ${styles.border} overflow-hidden`, children: _jsx("div", { className: "h-2 rounded", style: {
                                width: `${bar.value}%`,
                                backgroundColor: bar.value >= 75
                                    ? styles.chart.success
                                    : bar.value >= 50
                                        ? styles.chart.warning
                                        : styles.chart.danger,
                            } }) })] }, bar.label)))] }));
}
