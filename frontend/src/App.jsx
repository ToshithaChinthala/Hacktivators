import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { WsProvider } from './context/WsContext'
import AppLayout from './components/layout/AppLayout'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import SourceMarkPage from './pages/SourceMarkPage'
import PrivyPassPage from './pages/PrivyPassPage'
import TrustTestPage from './pages/TrustTestPage'
import EvidenceLockPage from './pages/EvidenceLockPage'
import TrustReportPage from './pages/TrustReportPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
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
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/sourcemark" element={<SourceMarkPage />} />
            <Route path="/privypass" element={<PrivyPassPage />} />
            <Route path="/trusttest" element={<TrustTestPage />} />
            <Route path="/evidencelock" element={<EvidenceLockPage />} />
            <Route path="/trust-report" element={<TrustReportPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </WsProvider>
    </BrowserRouter>
  )
}
