import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from '../../theme/useTheme';
export default function EmptyState({ title, description, action, tone = 'info', }) {
    const { styles } = useTheme();
    const toneStyles = {
        info: '',
        warning: 'border-yellow-500/40',
        critical: 'border-red-500/40',
    };
    return (_jsxs("div", { className: `
        flex
        flex-col
        items-center
        justify-center
        rounded-2xl
        border
        px-8
        py-14
        text-center
        ${styles.surface}
        ${styles.border}
        ${toneStyles[tone]}
      `, children: [_jsx("div", { className: `mb-3 text-lg font-semibold ${styles.text}`, children: title }), description && (_jsx("div", { className: "mb-6 max-w-md text-sm opacity-80", children: description })), action && _jsx("div", { children: action })] }));
}
