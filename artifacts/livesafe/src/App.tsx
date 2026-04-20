import React from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/hooks/useAuth'
import type { UserRole } from '@/types'

// Pages (lazy-loaded in a real prod app; kept synchronous here for clarity)
import LoginPage from '@/pages/LoginPage'
import NewApp from '@/components/new-ui/App'
import ReportIncidentPage from '@/pages/ReportIncidentPage'
import SOSAlertsPage from '@/pages/SOSAlertsPage'
import AnalyticsPage from '@/pages/AnalyticsPage'
import MLDashboardPage from '@/pages/MLDashboardPage'
import UserManagementPage from '@/pages/UserManagementPage'
import SettingsPage from '@/pages/SettingsPage'

// ---- Protected Route wrapper ----
interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: UserRole[]
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, user } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
      }}>
        <div className="spinner" style={{ width: 40, height: 40, borderWidth: 4 }} />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to map (default page) if role not permitted
    return <Navigate to="/map" replace />
  }

  return <>{children}</>
}

// ---- Default redirect based on role ----
function RoleRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  return <Navigate to="/map" replace />
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginRedirect />} />

      {/* Protected — all authenticated users */}
      <Route
        path="/"
        element={<ProtectedRoute><NewApp /></ProtectedRoute>}
      />
      {/* /map is the primary landing route after login — alias to the same shell */}
      <Route
        path="/map"
        element={<ProtectedRoute><NewApp /></ProtectedRoute>}
      />
      <Route
        path="/settings"
        element={<ProtectedRoute><SettingsPage /></ProtectedRoute>}
      />

      {/* Citizens only */}
      <Route
        path="/report"
        element={
          <ProtectedRoute allowedRoles={['citizen']}>
            <ReportIncidentPage />
          </ProtectedRoute>
        }
      />

      {/* Police + Admin */}
      <Route
        path="/sos"
        element={
          <ProtectedRoute allowedRoles={['police', 'admin']}>
            <SOSAlertsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={['police', 'admin']}>
            <AnalyticsPage />
          </ProtectedRoute>
        }
      />

      {/* Admin only */}
      <Route
        path="/ml"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <MLDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/users"
        element={
          <ProtectedRoute allowedRoles={['admin']}>
            <UserManagementPage />
          </ProtectedRoute>
        }
      />

      {/* Catch-all */}
<Route path="*" element={<RoleRedirect />} />
    </Routes>
  )
}

// Redirect authenticated users away from /login
function LoginRedirect() {
  const { isAuthenticated } = useAuth()
  if (isAuthenticated) return <Navigate to="/map" replace />
  return <LoginPage />
}
