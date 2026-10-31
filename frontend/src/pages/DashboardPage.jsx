import { useEffect, useState, useCallback, useRef } from 'react'
import { motion } from 'framer-motion'
import {
  Files, CheckCircle, AlertTriangle, ShieldCheck, Zap, Shield, Lock, Activity,
  TrendingUp, Clock, RefreshCw
} from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
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

  const verifiedCount = Number(stats.verified_files) || 0
  const modifiedCount = Number(stats.modified_files) || 0
  const totalEvaluated = verifiedCount + modifiedCount

  const verifiedPct = totalEvaluated > 0 ? ((verifiedCount / totalEvaluated) * 100).toFixed(1) : '0.0'
  const modifiedPct = totalEvaluated > 0 ? ((modifiedCount / totalEvaluated) * 100).toFixed(1) : '0.0'

  const pieData = [
    { name: 'Verified Files', value: verifiedCount, color: '#16A34A', percentage: verifiedPct },
    { name: 'Modified Detections', value: modifiedCount, color: '#DC647D', percentage: modifiedPct },
  ]
  const chartSlices = pieData.filter((d) => d.value > 0)

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
        {/* File Verification Overview Pie Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-slate-900 font-semibold text-sm">File Verification Overview</h3>
            <span className="text-xs font-medium text-slate-500">Total Analyzed: {totalEvaluated}</span>
          </div>
          {totalEvaluated === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-slate-400 text-sm">
              <p className="font-medium text-slate-500">No verification data yet</p>
              <p className="text-xs text-slate-400 mt-0.5">Verified files and modified detections will appear here.</p>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 h-44">
              <div className="w-full sm:w-1/2 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Tooltip
                      contentStyle={{
                        background: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: 8,
                        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
                        fontSize: 12,
                      }}
                      itemStyle={{ fontWeight: 600 }}
                      formatter={(val, name, entry) => [
                        `${val} files (${entry.payload.percentage}%)`,
                        name,
                      ]}
                    />
                    <Pie
                      data={chartSlices}
                      cx="50%"
                      cy="50%"
                      innerRadius={36}
                      outerRadius={64}
                      paddingAngle={chartSlices.length > 1 ? 4 : 0}
                      dataKey="value"
                      isAnimationActive={true}
                      animationDuration={700}
                    >
                      {chartSlices.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} stroke="#ffffff" strokeWidth={2} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend & Breakdown */}
              <div className="w-full sm:w-1/2 flex flex-col justify-center space-y-2.5 pr-2">
                {pieData.map((item) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50/80 border border-slate-100 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0 shadow-2xs"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-xs font-semibold text-slate-700">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900">{item.value}</span>
                      <span className="text-[11px] text-slate-500 font-medium ml-1.5">
                        ({item.percentage}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
