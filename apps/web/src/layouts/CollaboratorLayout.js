import { jsx as _jsx } from "react/jsx-runtime";
import { Outlet } from 'react-router-dom';
import CollaboratorShell from './CollaboratorShell';
export default function CollaboratorLayout() {
    return (_jsx(CollaboratorShell, { children: _jsx(Outlet, {}) }));
}
