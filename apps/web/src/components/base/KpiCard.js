import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from '../../theme/useTheme';
export default function KpiCard({ label, value }) {
    const { styles } = useTheme();
    return (_jsxs("div", { className: `
        rounded-lg border p-4
        ${styles.surface}
        ${styles.border}
      `, children: [_jsx("div", { className: "text-xs opacity-60", children: label }), _jsx("div", { className: "mt-1 text-2xl font-semibold", children: value })] }));
}
