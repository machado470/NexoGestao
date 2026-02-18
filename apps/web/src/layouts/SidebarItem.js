import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { NavLink } from 'react-router-dom';
import { useTheme } from '../theme/useTheme';
export default function SidebarItem({ to, label, icon: Icon, }) {
    const { styles } = useTheme();
    return (_jsxs(NavLink, { to: to, className: ({ isActive }) => `
        flex items-center gap-3 rounded-md px-3 py-2 text-sm
        transition-colors
        ${styles.text}
        ${isActive
            ? `${styles.surface} font-medium`
            : 'opacity-70 hover:opacity-100'}
      `, children: [_jsx(Icon, { size: 16 }), _jsx("span", { children: label })] }));
}
