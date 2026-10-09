import React, { Suspense } from 'react'
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/app/hooks/useAuth'
import type { UserRole } from '@/types'

const LoginPage = React.lazy(() => import('@/pages/LoginPage'))
const NewApp = React.lazy(() => import('@/components/new-ui/App'))
const ReportIncidentPage = React.lazy(() => import('@/pages/ReportIncidentPage'))
const SOSAlertsPage = React.lazy(() => import('@/pages/SOSAlertsPage'))
const DispatchPage = React.lazy(() => import('@/pages/DispatchPage'))
const AnalyticsPage = React.lazy(() => import('@/pages/AnalyticsPage'))
const MLDashboardPage = React.lazy(() => import('@/pages/MLDashboardPage'))
const UserManagementPage = React.lazy(() => import('@/pages/UserManagementPage'))
const SettingsPage = React.lazy(() => import('@/pages/SettingsPage'))
const SuperAdminRequestsPage = React.lazy(() => import('@/pages/SuperAdminRequestsPage'))

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

function LoadingScreen() {
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

// ---- Default redirect based on role ----
function RoleRedirect() {
  const { user } = useAuth()
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'super_admin') return <Navigate to="/super-admin" replace />
  return <Navigate to="/map" replace />
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
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

      {/* Super admin only */}
      <Route
        path="/super-admin"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <SuperAdminRequestsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/super-admin/dispatch"
        element={
          <ProtectedRoute allowedRoles={['super_admin']}>
            <DispatchPage />
          </ProtectedRoute>
        }
      />

        {/* Catch-all */}
        <Route path="*" element={<RoleRedirect />} />
      </Routes>
    </Suspense>
  )
}

// Redirect authenticated users away from /login
function LoginRedirect() {
  const { isAuthenticated, user } = useAuth()
  if (isAuthenticated) {
    if (user?.role === 'super_admin') return <Navigate to="/super-admin" replace />
    return <Navigate to="/map" replace />
  }
  return <LoginPage />
}
