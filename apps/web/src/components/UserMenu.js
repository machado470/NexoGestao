import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTheme } from '../theme/useTheme';
import { useMe } from '../hooks/useMe';
export default function UserMenu() {
    const { styles } = useTheme();
    const { me, loading } = useMe();
    if (loading) {
        return (_jsx("div", { className: `rounded-md p-3 text-sm ${styles.surface} ${styles.border}`, children: "Carregando\u2026" }));
    }
    return (_jsxs("div", { className: `
        rounded-md p-3 text-sm
        ${styles.surface}
        ${styles.border}
      `, children: [_jsx("div", { className: "font-medium", children: me?.email ?? 'Usuário' }), _jsx("div", { className: "text-xs opacity-60", children: me?.role ?? '—' })] }));
}
