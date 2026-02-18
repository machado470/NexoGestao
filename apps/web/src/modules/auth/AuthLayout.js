import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from '../../theme/useTheme';
export default function AuthLayout({ children, }) {
    const { styles } = useTheme();
    return (_jsx("div", { className: `
        min-h-screen
        flex items-center justify-center
        px-6
        ${styles.background}
        ${styles.textPrimary}
      `, children: _jsxs("div", { className: "w-full max-w-5xl grid md:grid-cols-2 gap-12 items-center", children: [_jsxs("div", { className: `hidden md:block ${styles.textPrimary}`, children: [_jsx("h1", { className: "text-4xl font-semibold leading-tight", children: "NexoGestao" }), _jsx("p", { className: `mt-4 max-w-md ${styles.textMuted}`, children: "Governan\u00E7a operacional com trilhas, risco humano e auditoria para times que precisam operar com dados reais." })] }), _jsx("div", { className: `
            rounded-2xl
            border
            p-8
            ${styles.surface}
            ${styles.border}
          `, children: children })] }) }));
}
