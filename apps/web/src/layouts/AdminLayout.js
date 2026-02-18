import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
export default function AdminLayout() {
    return (_jsxs("div", { className: "flex min-h-screen bg-slate-950 text-slate-100", children: [_jsx(Sidebar, {}), _jsx("main", { className: "flex-1 p-6 overflow-y-auto", children: _jsx(Outlet, {}) })] }));
}
