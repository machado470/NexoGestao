import { Routes, Route, Navigate } from 'react-router-dom'

import RequireAuth from './RequireAuth'
import RequireAdmin from './RequireAdmin'

import LandingPage from '../modules/landing/LandingPage'
import Login from '../modules/auth/Login'
import Onboarding from '../modules/onboarding/Onboarding'

import AdminShell from '../modules/admin/AdminShell'
import AdminDashboard from '../modules/admin/AdminDashboard'
import TracksPage from '../modules/admin/TracksPage'
import TrackDetail from '../modules/admin/TrackDetail'
import PeoplePage from '../modules/admin/PeoplePage'
import PersonDetailPage from '../modules/admin/PersonDetailPage'
import PersonCreate from '../modules/admin/PersonCreate'
import AuditPage from '../modules/admin/AuditPage'
import EvaluationsPage from '../modules/admin/EvaluationsPage'

// 🧩 NEXOGESTÃO OFICIAL
import CustomersPage from '../modules/admin/CustomersPage'

import CollaboratorLayout from '../modules/collaborator/CollaboratorLayout'
import CollaboratorDashboard from '../modules/collaborator/CollaboratorDashboard'
import AssessmentPage from '../modules/collaborator/AssessmentPage'
import TimelinePage from '../modules/collaborator/TimelinePage'

export default function Router() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />

      <Route element={<RequireAuth />}>
        <Route path="/onboarding" element={<Onboarding />} />

        <Route path="/collaborator" element={<CollaboratorLayout />}>
          <Route index element={<CollaboratorDashboard />} />
          <Route path="assessment/:assignmentId" element={<AssessmentPage />} />
          <Route path="timeline" element={<TimelinePage />} />
        </Route>
      </Route>

      <Route element={<RequireAdmin />}>
        <Route path="/admin" element={<AdminShell />}>
          <Route index element={<AdminDashboard />} />
          <Route path="pessoas" element={<PeoplePage />} />
          <Route path="pessoas/nova" element={<PersonCreate />} />
          <Route path="pessoas/:id" element={<PersonDetailPage />} />
          <Route path="trilhas" element={<TracksPage />} />
          <Route path="trilhas/:id" element={<TrackDetail />} />
          <Route path="avaliacoes" element={<EvaluationsPage />} />
          <Route path="auditoria" element={<AuditPage />} />

          {/* 🧩 NEXOGESTÃO OFICIAL */}
          <Route path="clientes" element={<CustomersPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
