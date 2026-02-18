import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, } from 'recharts';
import { useTheme } from '../../theme/useTheme';
export default function RiskTrendChart({ data }) {
    const { styles } = useTheme();
    if (!data || data.length === 0) {
        return (_jsx("div", { className: "h-48 w-full flex items-center justify-center text-sm opacity-60", children: "Sem dados hist\u00F3ricos suficientes para exibir tend\u00EAncia" }));
    }
    return (_jsx("div", { className: "h-48 w-full", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(LineChart, { data: data, children: [_jsx(XAxis, { dataKey: "label", stroke: "currentColor", opacity: 0.4 }), _jsx(YAxis, { stroke: "currentColor", opacity: 0.3 }), _jsx(Tooltip, { contentStyle: {
                            background: 'rgba(15,42,68,0.95)',
                            borderRadius: 8,
                            border: `1px solid ${styles.border}`,
                            color: '#fff',
                        } }), _jsx(Legend, {}), _jsx(Line, { name: "Cr\u00EDtico", type: "monotone", dataKey: "critical", stroke: styles.chart.danger, strokeWidth: 2, dot: false }), _jsx(Line, { name: "Alto", type: "monotone", dataKey: "high", stroke: styles.chart.warning, strokeWidth: 2, dot: false }), _jsx(Line, { name: "M\u00E9dio", type: "monotone", dataKey: "medium", stroke: styles.chart.primary, strokeWidth: 2, dot: false })] }) }) }));
}
