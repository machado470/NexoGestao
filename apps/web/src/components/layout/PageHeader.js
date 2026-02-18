import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from '../../theme/useTheme';
export default function PageHeader({ title, description, action, }) {
    const { styles } = useTheme();
    return (_jsxs("div", { className: "mb-6 flex items-start justify-between gap-4", children: [_jsxs("div", { children: [_jsx("h1", { className: `text-2xl font-semibold ${styles.text}`, children: title }), description && (_jsx("p", { className: `mt-1 text-sm ${styles.muted}`, children: description }))] }), action && _jsx("div", { children: action })] }));
}
