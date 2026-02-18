import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from '../theme/useTheme';
import ToggleThemeButton from '../components/ToggleThemeButton';
import UserMenu from '../components/layout/UserMenu';
export default function Topbar() {
    const { styles } = useTheme();
    return (_jsxs("header", { className: `
        mb-6 flex items-center justify-between
        rounded-xl border p-4
        ${styles.surface}
        ${styles.border}
      `, children: [_jsx("div", { className: `text-sm font-semibold ${styles.text}`, children: "Painel Administrativo" }), _jsxs("div", { className: "flex items-center gap-4", children: [_jsx(ToggleThemeButton, {}), _jsx(UserMenu, {})] })] }));
}
