import { useLocation } from 'react-router-dom'
import { Bell, Wifi, WifiOff } from 'lucide-react'
import { useWs } from '../../context/WsContext'

const titles = {
  '/dashboard': { title: 'Dashboard', sub: 'Platform overview and live metrics' },
  '/sourcemark': { title: 'SourceMark', sub: 'Content integrity verification' },
  '/privypass': { title: 'PrivyPass', sub: 'Selective-disclosure credential verification' },
  '/trusttest': { title: 'TrustTest AI', sub: 'AI prompt security testing' },
  '/evidencelock': { title: 'EvidenceLock', sub: 'Tamper-evident digital evidence' },
  '/trust-report': { title: 'Trust Report', sub: 'Unified platform trust assessment' },
  '/settings': { title: 'Settings', sub: 'Platform configuration' },
}

export default function Topbar() {
  const { pathname } = useLocation()
  const { connected } = useWs()
  const info = titles[pathname] || { title: 'TrustSphere AI', sub: '' }

  return (
    <header className="h-16 flex-shrink-0 glass border-b border-violet-500/10 flex items-center justify-between px-6 sticky top-0 z-30">
      <div>
        <h1 className="text-base font-semibold text-white">{info.title}</h1>
        <p className="text-xs text-slate-500">{info.sub}</p>
      </div>
      <div className="flex items-center gap-3">
        <div className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
          connected
            ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10'
            : 'text-slate-400 border-slate-500/30 bg-slate-500/10'
        }`}>
          {connected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          <span>{connected ? 'Live' : 'Offline'}</span>
        </div>
        <button className="p-2 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors relative">
          <Bell className="h-4 w-4" />
        </button>
        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center text-white text-xs font-bold">
          TS
        </div>
      </div>
    </header>
  )
}

