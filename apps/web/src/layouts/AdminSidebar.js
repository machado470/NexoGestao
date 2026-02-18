import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
import { useTheme } from '../theme/useTheme';
const links = [
    { to: '/admin', label: 'Dashboard' },
    { to: '/admin/pessoas', label: 'Pessoas' },
    { to: '/admin/trilhas', label: 'Trilhas' },
    { to: '/admin/auditoria', label: 'Auditoria' },
];
export default function AdminSidebar() {
    const { styles } = useTheme();
    return (_jsxs("aside", { className: `rounded border ${styles.cardBorder} ${styles.cardBg} p-3`, children: [_jsx("div", { className: "text-sm font-semibold mb-2", children: "Admin" }), _jsx("nav", { className: "space-y-1", children: links.map(l => (_jsx(NavLink, { to: l.to, end: l.to === '/admin', className: ({ isActive }) => [
                        'block text-sm px-3 py-2 rounded',
                        isActive ? styles.buttonPrimary : 'opacity-80 hover:opacity-100',
                    ].join(' '), children: l.label }, l.to))) })] }));
}
