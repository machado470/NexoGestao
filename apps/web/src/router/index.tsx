import { Routes, Route, Navigate } from 'react-router-dom'

import RequireAuth from './RequireAuth'
import { RequireAdmin } from './RequireAdmin'

// Público
import LandingPage from '../modules/landing/LandingPage'
import Login from '../modules/auth/Login'
import Onboarding from '../modules/onboarding/Onboarding'

// Admin
import AdminShell from '../modules/admin/AdminShell'
import AdminDashboard from '../modules/admin/AdminDashboard'
import TracksPage from '../modules/admin/TracksPage'
import TrackDetail from '../modules/admin/TrackDetail'
import PeoplePage from '../modules/admin/PeoplePage'
import PersonDetailPage from '../modules/admin/PersonDetailPage'
import PersonCreate from '../modules/admin/PersonCreate'
import AuditPage from '../modules/admin/AuditPage'
import EvaluationsPage from '../modules/admin/EvaluationsPage'

// Collaborator
import CollaboratorLayout from '../modules/collaborator/CollaboratorLayout'
import CollaboratorDashboard from '../modules/collaborator/CollaboratorDashboard'
import AssessmentPage from '../modules/collaborator/AssessmentPage'
import TimelinePage from '../modules/collaborator/TimelinePage'

export default function Router() {
  return (
    <Routes>
      {/* 🌐 Público */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<Login />} />

      {/* 🧠 Onboarding (autenticado) */}
      <Route
        path="/onboarding"
        element={
          <RequireAuth>
            <Onboarding />
          </RequireAuth>
        }
      />

      {/* 👤 Colaborador */}
      <Route
        path="/collaborator"
        element={
          <RequireAuth>
            <CollaboratorLayout />
          </RequireAuth>
        }
      >
        <Route index element={<CollaboratorDashboard />} />
        <Route
          path="assessment/:assignmentId"
          element={<AssessmentPage />}
        />
        <Route path="timeline" element={<TimelinePage />} />
      </Route>

      {/* 👑 Admin */}
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminShell />
          </RequireAdmin>
        }
      >
        <Route index element={<AdminDashboard />} />

        {/* Pessoas */}
        <Route path="pessoas" element={<PeoplePage />} />
        <Route
          path="pessoas/nova"
          element={<PersonCreate />}
        />
        <Route
          path="pessoas/:id"
          element={<PersonDetailPage />}
        />

        {/* Trilhas */}
        <Route path="trilhas" element={<TracksPage />} />
        <Route
          path="trilhas/:id"
          element={<TrackDetail />}
        />

        {/* Outros */}
        <Route
          path="avaliacoes"
          element={<EvaluationsPage />}
        />
        <Route path="auditoria" element={<AuditPage />} />
      </Route>

      {/* 🧹 Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
