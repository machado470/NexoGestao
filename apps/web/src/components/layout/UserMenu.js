import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMe } from '../../hooks/useMe';
import { useTheme } from '../../theme/useTheme';
export default function UserMenu() {
    const { me, loading } = useMe();
    const { styles } = useTheme();
    return (_jsxs("div", { className: `rounded-md p-3 text-sm ${styles.surface} ${styles.border}`, children: [_jsx("div", { className: "font-medium", children: loading ? '—' : me?.email ?? 'Usuário' }), _jsx("div", { className: "text-xs opacity-60", children: me?.role ?? '—' })] }));
}
