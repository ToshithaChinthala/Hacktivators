import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Files, CheckCircle, AlertTriangle, ShieldCheck, Zap, Shield, Lock, Activity,
  TrendingUp, Clock, RefreshCw
} from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import StatCard from '../components/ui/StatCard'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import StatusBadge from '../components/ui/StatusBadge'
import { dashboardApi } from '../api/endpoints'
import { useWs } from '../context/WsContext'
import toast from 'react-hot-toast'

const empty = {
  total_files: 0,
  verified_files: 0,
  modified_files: 0,
  checkpoints_count: 0,
  security_tests: 0,
  high_risk_count: 0,
  evidence_records: 0,
  trust_score: 0,
}

export default function DashboardPage() {
  const [stats, setStats] = useState(empty)
  const [activity, setActivity] = useState([])
  const [loading, setLoading] = useState(true)
  const { lastMessage } = useWs()
  const wsDebounceRef = useRef(null)

  const fetchData = useCallback(async (showErrorToast = false) => {
    try {
      const [sRes, aRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getRecentActivity(),
      ])
      setStats(sRes.data)
      setActivity(aRes.data)
    } catch (err) {
      if (showErrorToast) {
        toast.error('Could not reach backend — is it running?', { id: 'dashboard-fetch-error' })
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (!lastMessage) return
    if (wsDebounceRef.current) clearTimeout(wsDebounceRef.current)
    wsDebounceRef.current = setTimeout(() => fetchData(), 400)
    return () => clearTimeout(wsDebounceRef.current)
  }, [lastMessage, fetchData])

  const chartData = activity.slice(0, 10).reverse().map((a, i) => ({
    name: `T-${i}`,
    events: 1,
  }))

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" text="Loading dashboard…" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Platform Overview</h2>
          <p className="text-slate-500 text-sm mt-0.5">Real-time enterprise metrics from secure MySQL vault</p>
        </div>
        <button
          onClick={() => fetchData(true)}
          className="flex items-center gap-2 text-xs font-medium text-slate-600 hover:text-slate-900 px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className="h-3 w-3 text-slate-500" />
          Refresh
        </button>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Files} label="Total Files" value={stats.total_files} color="indigo" delay={0} />
        <StatCard icon={CheckCircle} label="Verified Files" value={stats.verified_files} color="emerald" delay={0.05} />
        <StatCard icon={AlertTriangle} label="Modified Detected" value={stats.modified_files} color="rose" delay={0.1} />
        <StatCard icon={ShieldCheck} label="Security Checkpoints" value={stats.checkpoints_count ?? 0} color="blue" delay={0.15} />
        <StatCard icon={Zap} label="Security Tests" value={stats.security_tests} color="amber" delay={0.2} />
        <StatCard icon={Shield} label="High Risk Hits" value={stats.high_risk_count} color="rose" delay={0.25} />
        <StatCard icon={Lock} label="Evidence Records" value={stats.evidence_records} color="violet" delay={0.3} />
        <StatCard icon={TrendingUp} label="Trust Score" value={`${stats.trust_score}%`} color="indigo" delay={0.35} />
      </div>

      {/* Chart + Activity */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Activity chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 font-semibold text-sm">Activity Overview</h3>
            <span className="text-xs font-medium text-slate-500">Last {activity.length} events</span>
          </div>
          {activity.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-slate-400 text-sm">
              No activity yet — start using modules to see data here.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="indigoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.18} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: 8,
                    boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                  }}
                  labelStyle={{ color: '#475569', fontSize: 11, fontWeight: 600 }}
                  itemStyle={{ color: '#4f46e5', fontSize: 11, fontWeight: 500 }}
                />
                <Area type="monotone" dataKey="events" stroke="#4f46e5" fill="url(#indigoGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Recent activity */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="h-4 w-4 text-indigo-600" />
            <h3 className="text-slate-900 font-semibold text-sm">Recent Activity</h3>
          </div>
          {activity.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-8">No events yet</div>
          ) : (
            <ul className="space-y-3">
              {activity.slice(0, 8).map((a, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-2.5"
                >
                  <div className="h-2 w-2 rounded-full bg-indigo-600 mt-1 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-slate-800 text-xs font-medium truncate">{a.action}</p>
                    <p className="text-slate-400 text-xs truncate">{a.actor} · {new Date(a.timestamp).toLocaleTimeString()}</p>
                  </div>
                </motion.li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Module status */}
      <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs">
        <h3 className="text-slate-900 font-semibold text-sm mb-4">Module Operational Status</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { name: 'SourceMark', icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100', status: 'Active' },
            { name: 'ProvenanceGuard', icon: ShieldCheck, color: 'text-blue-600', bg: 'bg-blue-50 border-blue-100', status: 'Active' },
            { name: 'TrustTest AI', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', status: 'Active' },
            { name: 'EvidenceLock', icon: Lock, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', status: 'Active' },
          ].map(({ name, icon: Icon, color, bg, status }) => (
            <div key={name} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50/70 border border-slate-200/70">
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${bg}`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
              <div>
                <div className="text-slate-900 text-xs font-semibold">{name}</div>
                <div className="text-emerald-600 text-xs font-medium flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                  {status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
