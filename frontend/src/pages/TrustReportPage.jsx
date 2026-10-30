import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, RefreshCw, Shield, Key, Zap, Lock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react'
import { reportsApi } from '../api/endpoints'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'

export default function TrustReportPage() {
  const [report, setReport] = useState(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(false)

  const fetchReport = useCallback(async () => {
    setLoading(true)
    try {
      const res = await reportsApi.getTrustReport()
      setReport(res.data)
    } catch {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchReport() }, [fetchReport])

  const handleDownload = async () => {
    setDownloading(true)
    try {
      const res = await reportsApi.downloadPdf()
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `TrustSphere_Report_${Date.now()}.pdf`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded')
    } catch { toast.error('PDF download failed') }
    finally { setDownloading(false) }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <LoadingSpinner size="lg" text="Generating trust report…" />
    </div>
  )

  const score = report?.overall_score ?? 0
  const scoreColor = score >= 80 ? 'text-emerald-400' : score >= 60 ? 'text-amber-400' : score >= 40 ? 'text-orange-400' : 'text-red-400'
  const scoreBg = score >= 80 ? 'from-emerald-600/20 to-emerald-900/10 border-emerald-500/25'
    : score >= 60 ? 'from-amber-600/20 to-amber-900/10 border-amber-500/25'
    : 'from-red-600/20 to-red-900/10 border-red-500/25'

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Trust Report</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            {report?.report_id ? `ID: ${report.report_id}` : 'Unified platform assessment'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={fetchReport} className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg glass border border-white/10 transition-colors">
            <RefreshCw className="h-3 w-3" />Refresh
          </button>
          <button onClick={handleDownload} disabled={downloading || !report} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50">
            <Download className="h-3 w-3" />{downloading ? 'Downloading…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {!report ? (
        <div className="glass rounded-xl p-10 border border-violet-500/15 text-center text-slate-500">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>No data available yet — use the platform modules to generate a report.</p>
        </div>
      ) : (
        <>
          {/* Overall score */}
          <div className={`glass rounded-xl p-6 border bg-gradient-to-br ${scoreBg}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">Overall Trust Score</p>
                <div className={`text-5xl font-black ${scoreColor}`}>{score}<span className="text-2xl font-normal opacity-60">%</span></div>
                <p className="text-slate-400 text-sm mt-1">{report.overall_status}</p>
              </div>
              <div className="h-24 w-24 relative">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="40" fill="none"
                    stroke={score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'}
                    strokeWidth="8"
                    strokeDasharray={`${score * 2.51} 251`}
                    strokeLinecap="round"
                  />
                </svg>
                <TrendingUp className={`h-6 w-6 ${scoreColor} absolute inset-0 m-auto`} />
              </div>
            </div>
          </div>

          {/* Module scores */}
          <div className="grid lg:grid-cols-2 gap-5">
            <ModuleCard
              icon={Shield} name="SourceMark" color="violet"
              data={report.sourcemark}
              fields={[
                { label: 'Total Files', key: 'total_files' },
                { label: 'Verified', key: 'verified_files' },
                { label: 'Modified', key: 'modified_files' },
                { label: 'Integrity Score', key: 'integrity_score', suffix: '%' },
              ]}
            />
            <ModuleCard
              icon={Key} name="PrivyPass" color="blue"
              data={report.privypass}
              fields={[
                { label: 'Total Verifications', key: 'total_verifications' },
                { label: 'Eligible', key: 'eligible_count' },
                { label: 'Denied', key: 'denied_count' },
                { label: 'Privacy Score', key: 'privacy_score', suffix: '%' },
              ]}
            />
            <ModuleCard
              icon={Zap} name="TrustTest AI" color="amber"
              data={report.trusttest}
              fields={[
                { label: 'Total Tests', key: 'total_tests' },
                { label: 'High Risk', key: 'high_risk_count' },
                { label: 'Critical', key: 'critical_count' },
                { label: 'Security Score', key: 'security_score', suffix: '%' },
              ]}
            />
            <ModuleCard
              icon={Lock} name="EvidenceLock" color="emerald"
              data={report.evidencelock}
              fields={[
                { label: 'Evidence Records', key: 'total_records' },
                { label: 'Audit Events', key: 'audit_events' },
                { label: 'Chain Status', key: 'chain_status' },
                { label: 'Integrity Score', key: 'integrity_score', suffix: '%' },
              ]}
            />
          </div>

          {/* Report metadata */}
          <div className="glass rounded-xl p-5 border border-violet-500/15">
            <h3 className="text-white font-semibold text-sm mb-3">Report Metadata</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Report ID', value: report.report_id },
                { label: 'Generated', value: report.created_at ? new Date(report.created_at).toLocaleString() : 'Now' },
                { label: 'Database', value: 'MySQL 8.0' },
                { label: 'Platform', value: 'TrustSphere AI v1.0' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-slate-500 text-xs">{label}</p>
                  <p className="text-slate-200 text-sm font-medium">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function ModuleCard({ icon: Icon, name, color, data, fields }) {
  const colors = {
    violet: 'from-violet-600/15 to-violet-900/5 border-violet-500/20 text-violet-400',
    blue: 'from-blue-600/15 to-blue-900/5 border-blue-500/20 text-blue-400',
    amber: 'from-amber-600/15 to-amber-900/5 border-amber-500/20 text-amber-400',
    emerald: 'from-emerald-600/15 to-emerald-900/5 border-emerald-500/20 text-emerald-400',
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`glass rounded-xl p-5 border bg-gradient-to-br ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-4">
        <Icon className={`h-5 w-5 ${colors[color].split(' ')[3]}`} />
        <h4 className="text-white font-semibold">{name}</h4>
      </div>
      {!data ? (
        <p className="text-slate-500 text-sm">No data available</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {fields.map(({ label, key, suffix }) => (
            <div key={key}>
              <p className="text-slate-500 text-xs">{label}</p>
              <p className="text-white text-lg font-bold">
                {data[key] !== undefined && data[key] !== null ? `${data[key]}${suffix || ''}` : '—'}
              </p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

