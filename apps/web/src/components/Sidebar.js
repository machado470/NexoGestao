import { jsx as _jsx } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
import { useTheme } from '../theme/useTheme';
export default function Sidebar({ items = [] }) {
    const { styles } = useTheme();
    return (_jsx("aside", { className: `rounded border ${styles.cardBorder} ${styles.cardBg} p-3`, children: _jsx("nav", { className: "space-y-1", children: items.map(i => (_jsx(NavLink, { to: i.to, className: ({ isActive }) => [
                    'block text-sm px-3 py-2 rounded',
                    isActive ? styles.buttonPrimary : 'opacity-80 hover:opacity-100',
                ].join(' '), children: i.label }, i.to))) }) }));
}
