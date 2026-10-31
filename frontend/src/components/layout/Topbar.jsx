import { useLocation } from 'react-router-dom'
import { Bell, Wifi, WifiOff } from 'lucide-react'
import { useWs } from '../../context/WsContext'
import { useAuth } from '../../context/AuthContext'

const titles = {
  '/dashboard': { title: 'Dashboard', sub: 'Platform overview and live metrics' },
  '/sourcemark': { title: 'SourceMark', sub: 'Content integrity & cryptographic fingerprinting' },
  '/trusttest': { title: 'TrustTest AI', sub: 'AI prompt security & injection testing' },
  '/evidencelock': { title: 'EvidenceLock', sub: 'Tamper-evident audit ledger & actor isolation' },
  '/provenanceguard': { title: 'ProvenanceGuard', sub: 'Anti-rollback witness, re-save detection, key lifecycle' },
  '/trust-report': { title: 'Trust Report', sub: 'Unified platform trust assessment & compliance export' },
  '/settings': { title: 'Settings', sub: 'Platform configuration & API endpoints' },
}

export default function Topbar() {
  const { pathname } = useLocation()
  const { connected } = useWs()
  const { user } = useAuth()
  const info = titles[pathname] || { title: 'TrustSphere AI', sub: '' }

  return (
    <header className="h-16 flex-shrink-0 bg-white/90 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between px-6 sticky top-0 z-30 shadow-xs">
      <div>
        <h1 className="text-base font-bold text-slate-900 tracking-tight">{info.title}</h1>
        <p className="text-xs text-slate-500 font-medium">{info.sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
          connected
            ? 'text-emerald-700 border-emerald-200 bg-emerald-50'
            : 'text-slate-500 border-slate-200 bg-slate-50'
        }`}>
          {connected ? <Wifi className="h-3 w-3 text-emerald-600" /> : <WifiOff className="h-3 w-3 text-slate-400" />}
          <span>{connected ? 'Live Sync' : 'Offline'}</span>
        </div>
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center text-white text-xs font-bold shadow-xs">
          {user?.email ? user.email.charAt(0).toUpperCase() : 'TS'}
        </div>
      </div>
    </header>
  )
}
