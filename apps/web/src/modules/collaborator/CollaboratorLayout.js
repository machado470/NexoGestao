import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth';
import { useTheme } from '../../theme/useTheme';
export default function CollaboratorLayout() {
    const { styles } = useTheme();
    const { logout } = useAuth();
    const navigate = useNavigate();
    function handleLogout() {
        logout();
        navigate('/login', { replace: true });
    }
    return (_jsx("div", { className: `min-h-screen ${styles.background} ${styles.textPrimary}`, children: _jsxs("div", { className: "max-w-5xl mx-auto px-4 py-6", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("div", { className: "text-lg font-semibold", children: "Colaborador" }), _jsx("button", { onClick: handleLogout, className: `text-xs rounded px-3 py-1 ${styles.buttonPrimary}`, children: "Sair" })] }), _jsx("div", { className: "mt-6", children: _jsx(Outlet, {}) })] }) }));
}
