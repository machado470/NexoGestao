import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { useTheme } from '../../theme/useTheme';
function NavItem({ to, label }) {
    return (_jsx(NavLink, { to: to, className: ({ isActive }) => `text-xs rounded px-3 py-1 border border-white/10 ${isActive ? 'bg-white/10' : 'bg-transparent'}`, children: label }));
}
export default function AdminShell() {
    const { styles } = useTheme();
    const { logout } = useAuth();
    const navigate = useNavigate();
    function handleLogout() {
        logout();
        navigate('/login', { replace: true });
    }
    return (_jsx("div", { className: `min-h-screen ${styles.background} ${styles.textPrimary}`, children: _jsxs("div", { className: "max-w-6xl mx-auto px-4 py-6", children: [_jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "text-lg font-semibold", children: "Admin" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(NavItem, { to: "/admin", label: "Dashboard" }), _jsx(NavItem, { to: "/admin/pessoas", label: "Pessoas" }), _jsx(NavItem, { to: "/admin/trilhas", label: "Trilhas" }), _jsx(NavItem, { to: "/admin/clientes", label: "Clientes" })] })] }), _jsx("button", { onClick: handleLogout, className: `text-xs rounded px-3 py-1 ${styles.buttonPrimary}`, children: "Sair" })] }), _jsx("div", { className: "mt-6", children: _jsx(Outlet, {}) })] }) }));
}
