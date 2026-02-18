import { jsx as _jsx } from "react/jsx-runtime";
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
export default function RequireAdmin() {
    const { isAuthenticated, loading, user } = useAuth();
    if (loading)
        return null;
    if (!isAuthenticated)
        return _jsx(Navigate, { to: "/login", replace: true });
    if (user?.role !== 'ADMIN') {
        return _jsx(Navigate, { to: "/collaborator", replace: true });
    }
    return _jsx(Outlet, {});
}
