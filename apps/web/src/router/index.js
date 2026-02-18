import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Routes, Route, Navigate } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import RequireAdmin from './RequireAdmin';
import LandingPage from '../modules/landing/LandingPage';
import Login from '../modules/auth/Login';
import Onboarding from '../modules/onboarding/Onboarding';
import AdminShell from '../modules/admin/AdminShell';
import AdminDashboard from '../modules/admin/AdminDashboard';
import TracksPage from '../modules/admin/TracksPage';
import TrackDetail from '../modules/admin/TrackDetail';
import PeoplePage from '../modules/admin/PeoplePage';
import PersonDetailPage from '../modules/admin/PersonDetailPage';
import PersonCreate from '../modules/admin/PersonCreate';
import AuditPage from '../modules/admin/AuditPage';
import EvaluationsPage from '../modules/admin/EvaluationsPage';
import CustomersPage from '../modules/admin/CustomersPage';
import CollaboratorLayout from '../modules/collaborator/CollaboratorLayout';
import CollaboratorDashboard from '../modules/collaborator/CollaboratorDashboard';
import AssessmentPage from '../modules/collaborator/AssessmentPage';
import TimelinePage from '../modules/collaborator/TimelinePage';
export default function Router() {
    return (_jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(LandingPage, {}) }), _jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsxs(Route, { element: _jsx(RequireAuth, {}), children: [_jsx(Route, { path: "/onboarding", element: _jsx(Onboarding, {}) }), _jsxs(Route, { path: "/collaborator", element: _jsx(CollaboratorLayout, {}), children: [_jsx(Route, { index: true, element: _jsx(CollaboratorDashboard, {}) }), _jsx(Route, { path: "assessment/:assignmentId", element: _jsx(AssessmentPage, {}) }), _jsx(Route, { path: "timeline", element: _jsx(TimelinePage, {}) })] })] }), _jsx(Route, { element: _jsx(RequireAdmin, {}), children: _jsxs(Route, { path: "/admin", element: _jsx(AdminShell, {}), children: [_jsx(Route, { index: true, element: _jsx(AdminDashboard, {}) }), _jsx(Route, { path: "pessoas", element: _jsx(PeoplePage, {}) }), _jsx(Route, { path: "pessoas/nova", element: _jsx(PersonCreate, {}) }), _jsx(Route, { path: "pessoas/:id", element: _jsx(PersonDetailPage, {}) }), _jsx(Route, { path: "trilhas", element: _jsx(TracksPage, {}) }), _jsx(Route, { path: "trilhas/:id", element: _jsx(TrackDetail, {}) }), _jsx(Route, { path: "avaliacoes", element: _jsx(EvaluationsPage, {}) }), _jsx(Route, { path: "auditoria", element: _jsx(AuditPage, {}) }), _jsx(Route, { path: "clientes", element: _jsx(CustomersPage, {}) })] }) }), _jsx(Route, { path: "*", element: _jsx(Navigate, { to: "/", replace: true }) })] }));
}
