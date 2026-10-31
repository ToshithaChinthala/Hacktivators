import { NavLink, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Shield, Zap, Lock, FileText, Settings,
  ChevronLeft, ChevronRight, Activity, ShieldCheck, LogOut
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import toast from 'react-hot-toast'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sourcemark', icon: Shield, label: 'SourceMark' },
  { to: '/trusttest', icon: Zap, label: 'TrustTest AI' },
  { to: '/evidencelock', icon: Lock, label: 'EvidenceLock' },
  { to: '/provenanceguard', icon: ShieldCheck, label: 'ProvenanceGuard' },
  { to: '/trust-report', icon: FileText, label: 'Trust Report' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    try {
      await logout()
      toast.success('Logged out successfully')
      navigate('/login')
    } catch {
      navigate('/login')
    }
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.25, ease: 'easeInOut' }}
      className="flex-shrink-0 h-screen sticky top-0 flex flex-col bg-white border-r border-slate-200/80 shadow-xs overflow-hidden z-40"
    >
      {/* Brand Logo */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-slate-100">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm shadow-indigo-500/20">
          <Activity className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="text-sm font-bold text-slate-900 leading-tight tracking-tight">TrustSphere</div>
            <div className="text-[11px] text-indigo-600 font-semibold tracking-wide">ENTERPRISE AI</div>
          </motion.div>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group relative ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200/60 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={`h-4 w-4 flex-shrink-0 transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                }`} />
                {!collapsed && (
                  <span className="truncate">{label}</span>
                )}
                {collapsed && (
                  <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 text-white text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-md">
                    {label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User Session & Logout */}
      <div className="p-3 border-t border-slate-100 space-y-2">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 p-2 rounded-lg bg-slate-50 border border-slate-200/70">
              <div className="h-7 w-7 rounded-full bg-indigo-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-800 truncate" title={user?.email}>
                  {user?.email || 'User'}
                </p>
                <span className={`inline-block text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded ${
                  user?.role === 'admin'
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {user?.role || 'user'}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div
              className="h-8 w-8 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center text-xs font-bold"
              title={`${user?.email || 'User'} (${user?.role || 'user'})`}
            >
              {user?.email ? user.email.charAt(0).toUpperCase() : 'U'}
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <div className="p-2 border-t border-slate-100">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </motion.aside>
  )
}
