import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider, useAuth } from './context/AuthContext'
import { WsProvider } from './context/WsContext'
import AppLayout from './components/layout/AppLayout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SourceMarkPage from './pages/SourceMarkPage'
import TrustTestPage from './pages/TrustTestPage'
import EvidenceLockPage from './pages/EvidenceLockPage'
import TrustReportPage from './pages/TrustReportPage'
import SettingsPage from './pages/SettingsPage'
import ProvenanceGuardPage from './pages/ProvenanceGuardPage'
import LoadingSpinner from './components/ui/LoadingSpinner'

function ProtectedLayout() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <AppLayout />
}

function RootRoute() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  // When opening the website, show login/register screen unless already authenticated
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WsProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#0d1224',
                color: '#f1f5f9',
                border: '1px solid rgba(124,58,237,0.3)',
                borderRadius: '12px',
                fontSize: '13px',
              },
            }}
          />
          <Routes>
            <Route path="/" element={<RootRoute />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/landing" element={<LandingPage />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/sourcemark" element={<SourceMarkPage />} />
              <Route path="/trusttest" element={<TrustTestPage />} />
              <Route path="/evidencelock" element={<EvidenceLockPage />} />
              <Route path="/trust-report" element={<TrustReportPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/provenanceguard" element={<ProvenanceGuardPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </WsProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
