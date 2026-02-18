import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from '../../theme/useTheme';
export function ChartCard({ title, children }) {
    const { styles } = useTheme();
    return (_jsxs("div", { className: `border ${styles.border} ${styles.surface} rounded p-4 space-y-4`, children: [title && (_jsx("h3", { className: `text-sm font-semibold ${styles.muted}`, children: title })), children] }));
}
