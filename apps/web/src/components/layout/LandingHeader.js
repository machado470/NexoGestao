import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Link } from 'react-router-dom';
import { useTheme } from '../../theme/useTheme';
export default function LandingHeader() {
    const { styles } = useTheme();
    return (_jsx("header", { className: `
        sticky top-0 z-40
        border-b
        ${styles.surface}
        ${styles.border}
      `, children: _jsxs("div", { className: "max-w-7xl mx-auto px-6 h-16 flex items-center justify-between", children: [_jsx(Link, { to: "/", className: `font-semibold ${styles.textPrimary}`, children: "NexoGestao" }), _jsxs("div", { className: "flex items-center gap-3", children: [_jsx(Link, { to: "/login", className: `
              px-4 py-2 text-sm rounded-lg
              border
              ${styles.border}
              ${styles.textMuted}
              hover:${styles.navHover}
              transition
            `, children: "Entrar" }), _jsx("a", { href: "#cta", className: `
              px-4 py-2 text-sm rounded-lg
              ${styles.buttonPrimary}
              transition
            `, children: "Solicitar acesso" })] })] }) }));
}
