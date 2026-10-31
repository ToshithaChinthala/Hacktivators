import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { FileText, Download, RefreshCw, Shield, ShieldCheck, Zap, Lock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react'
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
  const scoreColor = score >= 80 ? 'text-emerald-600' : score >= 60 ? 'text-amber-600' : score >= 40 ? 'text-orange-600' : 'text-rose-600'

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Trust Report</h2>
          <p className="text-slate-500 text-sm mt-0.5">
            {report?.report_id ? `ID: ${report.report_id}` : 'Unified platform assessment'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchReport}
            className="flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900 px-3.5 py-1.5 rounded-lg bg-white border border-slate-200 shadow-2xs hover:bg-slate-50 transition-colors"
          >
            <RefreshCw className="h-3 w-3 text-slate-500" />Refresh
          </button>
          <button
            onClick={handleDownload}
            disabled={downloading || !report}
            className="flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-xs"
          >
            <Download className="h-3 w-3" />{downloading ? 'Downloading…' : 'Download PDF'}
          </button>
        </div>
      </div>

      {!report ? (
        <div className="bg-white rounded-xl p-10 border border-slate-200/80 shadow-xs text-center text-slate-400">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30 text-slate-400" />
          <p>No data available yet — use the platform modules to generate a report.</p>
        </div>
      ) : (
        <>
          {/* Overall score */}
          <div className="bg-gradient-to-r from-indigo-50/90 via-white to-violet-50/90 rounded-xl p-6 border border-indigo-100 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-1">Overall Trust Score</p>
                <div className={`text-5xl font-black ${scoreColor}`}>{score}<span className="text-2xl font-normal opacity-60">%</span></div>
                <p className="text-slate-700 text-sm font-medium mt-1">{report.overall_status}</p>
              </div>
              <div className="h-24 w-24 relative">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
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
              icon={Shield} name="SourceMark" color="indigo"
              data={report.sourcemark}
              fields={[
                { label: 'Total Files', key: 'total_files' },
                { label: 'Verified', key: 'verified_files' },
                { label: 'Modified', key: 'modified_files' },
                { label: 'Integrity Score', key: 'integrity_score', suffix: '%' },
              ]}
            />
            <ModuleCard
              icon={ShieldCheck} name="ProvenanceGuard" color="blue"
              data={report.provenanceguard}
              fields={[
                { label: 'Checkpoints', key: 'checkpoints_count' },
                { label: 'Active Keys', key: 'active_keys' },
                { label: 'Signatures', key: 'total_signatures' },
                { label: 'Protection Status', key: 'protection_status' },
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
          <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs">
            <h3 className="text-slate-900 font-semibold text-sm mb-3">Report Metadata</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Report ID', value: report.report_id },
                { label: 'Generated', value: report.created_at ? new Date(report.created_at).toLocaleString() : 'Now' },
                { label: 'Database', value: 'MySQL 8.0' },
                { label: 'Platform', value: 'TrustSphere AI v1.0' },
              ].map(({ label, value }) => (
                <div key={label} className="p-3 bg-slate-50 rounded-lg border border-slate-200/60">
                  <p className="text-slate-500 text-xs font-medium">{label}</p>
                  <p className="text-slate-800 text-sm font-semibold truncate mt-0.5">{value}</p>
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
  const colorMap = {
    indigo: { icon: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100' },
    blue: { icon: 'text-blue-600', bg: 'bg-blue-50 border-blue-100' },
    amber: { icon: 'text-amber-600', bg: 'bg-amber-50 border-amber-100' },
    emerald: { icon: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100' },
  }
  const styling = colorMap[color] || colorMap.indigo

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs">
      <div className="flex items-center gap-2.5 mb-4">
        <div className={`h-8 w-8 rounded-lg flex items-center justify-center border ${styling.bg}`}>
          <Icon className={`h-4 w-4 ${styling.icon}`} />
        </div>
        <h4 className="text-slate-900 font-semibold text-sm">{name}</h4>
      </div>
      {!data ? (
        <p className="text-slate-400 text-sm">No data available</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {fields.map(({ label, key, suffix }) => (
            <div key={key} className="p-3 bg-slate-50/70 rounded-lg border border-slate-100">
              <p className="text-slate-500 text-xs font-medium">{label}</p>
              <p className="text-slate-900 text-lg font-bold mt-0.5">
                {data[key] !== undefined && data[key] !== null ? `${data[key]}${suffix || ''}` : '—'}
              </p>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  )
}
