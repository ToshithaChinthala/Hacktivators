
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, Clock, Key, RefreshCw, AlertTriangle, CheckCircle,
  XCircle, FileSearch, Link, Upload, RotateCcw, Lock, Unlock,
  AlertOctagon, Eye, PenTool, ChevronDown, ChevronUp, Info,
  FileText, Download, X
} from 'lucide-react'
import { provenanceguardApi, sourcemarkApi } from '../api/endpoints'
import toast from 'react-hot-toast'
import LoadingSpinner from '../components/ui/LoadingSpinner'

const TABS = [
  { id: 'rollback', label: 'Rollback Protection', icon: ShieldCheck },
  { id: 'resave', label: 'Re-Save Analysis', icon: FileSearch },
  { id: 'keys', label: 'Signing Key Security', icon: Key },
]

export default function ProvenanceGuardPage() {
  const [tab, setTab] = useState('rollback')

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="rounded-xl p-5 border border-indigo-100 bg-gradient-to-r from-indigo-50/90 via-violet-50/70 to-blue-50/90 shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3.5">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-md shadow-indigo-600/20">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="text-slate-900 font-bold text-base tracking-tight">ProvenanceGuard</h2>
            <p className="text-slate-600 text-xs mt-0.5">
              Rollback Protection · Legitimate Re-Save Detection · Stolen Signing Key Defense
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200/80 shadow-2xs w-fit flex-wrap">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'rollback' && (
          <motion.div
            key="rollback"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <RollbackTab />
          </motion.div>
        )}
        {tab === 'resave' && (
          <motion.div
            key="resave"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <ResaveTab />
          </motion.div>
        )}
        {tab === 'keys' && (
          <motion.div
            key="keys"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <KeysTab />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ══════════════════════════════════════════════════════
// FEATURE A — ROLLBACK PROTECTION TAB
// ══════════════════════════════════════════════════════

function RollbackTab() {
  const [checkpoints, setCheckpoints] = useState([])
  const [rollbackResult, setRollbackResult] = useState(null)
  const [witness, setWitness] = useState(null)
  const [creating, setCreating] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [isSimulated, setIsSimulated] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [reportData, setReportData] = useState(null)
  const [generatingReport, setGeneratingReport] = useState(false)

  const handleGenerateRollbackReport = async () => {
    if (!rollbackResult) return
    setGeneratingReport(true)
    try {
      const res = await provenanceguardApi.generateRollbackReport(rollbackResult)
      setReportData(res.data)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to generate Rollback Report')
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleDownloadRollbackPdf = async () => {
    if (!rollbackResult) return
    try {
      const res = await provenanceguardApi.downloadRollbackPdf(rollbackResult)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Rollback_Report_${reportData?.report_id || Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Rollback Report PDF downloaded')
    } catch (err) {
      toast.error('Failed to download PDF')
    }
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [cpRes, wRes] = await Promise.allSettled([
        provenanceguardApi.listCheckpoints(),
        provenanceguardApi.getWitnessStore(),
      ])
      if (cpRes.status === 'fulfilled') {
        const raw = cpRes.value?.data
        if (Array.isArray(raw)) {
          setCheckpoints(raw)
        } else if (raw && Array.isArray(raw.checkpoints)) {
          setCheckpoints(raw.checkpoints)
        } else if (raw && Array.isArray(raw.data)) {
          setCheckpoints(raw.data)
        } else if (raw && Array.isArray(raw.items)) {
          setCheckpoints(raw.items)
        } else {
          setCheckpoints([])
          if (raw && typeof raw === 'object' && raw.detail) {
            setError(typeof raw.detail === 'string' ? raw.detail : 'Invalid checkpoint response')
          }
        }
      } else {
        setCheckpoints([])
        const errDetail = cpRes.reason?.response?.data?.detail || cpRes.reason?.message || 'Failed to load checkpoints'
        setError(typeof errDetail === 'string' ? errDetail : 'Failed to load checkpoints')
      }

      if (wRes.status === 'fulfilled') {
        setWitness(wRes.value?.data || null)
      }
    } catch (err) {
      setError(err?.message || 'Error loading checkpoints')
      setCheckpoints([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleCreateCheckpoint = async () => {
    setCreating(true)
    try {
      const res = await provenanceguardApi.createCheckpoint('user')
      if (res.data.status === 'CREATED') {
        toast.success(`Checkpoint ${res.data.checkpoint_id} created`)
      } else {
        toast(res.data.message || 'No entries to checkpoint yet')
      }
      await refresh()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Checkpoint creation failed')
    } finally {
      setCreating(false)
    }
  }

  const handleVerify = async () => {
    setVerifying(true)
    setRollbackResult(null)
    setIsSimulated(false) // always ensures genuine verification of real MySQL database
    try {
      const res = await provenanceguardApi.verifyRollback()
      setRollbackResult(res.data)
      if (res.data.rollback_detected) {
        toast.error(`ALERT: ${res.data.status.replace(/_/g, ' ')}`, { duration: 6000 })
      } else if (res.data.status === 'INTACT') {
        toast.success('Audit chain integrity confirmed — no rollback detected')
      } else {
        toast(res.data.message || 'No checkpoint to verify against')
      }
    } catch (err) {
      toast.error('Rollback verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleSimulateRollback = async () => {
    setSimulating(true)
    setRollbackResult(null)
    try {
      const res = await provenanceguardApi.simulateRollback()
      setRollbackResult(res.data)
      setIsSimulated(true)
      if (res.data.rollback_detected) {
        toast.error('Simulation: Rollback Attack Detected! (NOT INTACT)', { icon: '🚨', duration: 5000 })
      } else {
        toast(res.data.message || 'Simulation completed')
      }
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Rollback simulation failed')
    } finally {
      setSimulating(false)
    }
  }

  const handleResetSimulation = () => {
    setRollbackResult(null)
    setIsSimulated(false)
    toast.success('Simulation cleared. Showing standard live database state.')
  }

  const checkpointList = Array.isArray(checkpoints) ? checkpoints : []
  const latestCheckpoint = witness?.latest

  return (
    <div className="space-y-5">
      {/* Trust Model Notice */}
      <TrustNotice
        title="Independent Witness Architecture"
        text="Checkpoints are stored in BOTH MySQL and an independent filesystem witness file (backend/checkpoints/witness_store.json). Even if the database is rolled back to an older snapshot, the witness file retains the true checkpoint — enabling rollback detection. Limitation: total filesystem compromise requires an offline backup."
      />

      {/* Action Bar */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={handleCreateCheckpoint}
          disabled={creating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs text-sm font-medium transition-colors disabled:opacity-50"
        >
          <Clock className="h-4 w-4" />
          {creating ? 'Creating Checkpoint…' : 'Create Trusted Checkpoint'}
        </button>
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-sm font-medium transition-colors disabled:opacity-50"
        >
          <ShieldCheck className="h-4 w-4" />
          {verifying ? 'Verifying…' : 'Verify Rollback Protection'}
        </button>
        <button
          onClick={handleSimulateRollback}
          disabled={simulating || verifying || creating}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white shadow-xs text-sm font-semibold transition-colors disabled:opacity-50"
        >
          <AlertOctagon className="h-4 w-4" />
          {simulating ? 'Simulating Attack…' : 'Simulate Rollback Attack'}
        </button>
        {isSimulated && (
          <button
            onClick={handleResetSimulation}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-600 hover:bg-slate-700 text-white shadow-xs text-sm font-semibold transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Reset Simulation
          </button>
        )}
        <button
          onClick={refresh}
          disabled={loading}
          className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Active Simulation Notice Banner */}
      {isSimulated && (
        <div className="rounded-xl p-4 border border-amber-300 bg-amber-50 text-xs shadow-2xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-900 flex items-center gap-1.5 uppercase tracking-wide">
              <AlertOctagon className="h-4 w-4 text-amber-700" />
              Simulation Active — Non-Destructive Rollback Attack Demonstration
            </span>
            <button
              onClick={handleResetSimulation}
              className="text-amber-800 underline font-semibold hover:text-amber-950 transition-colors"
            >
              Reset Simulation
            </button>
          </div>
          <p className="text-slate-700 leading-relaxed">
            This simulation evaluates an in-memory snapshot older than the trusted witness checkpoint.
            <strong className="text-slate-900"> Zero actual MySQL records were deleted or modified.</strong> The independent witness file (<code className="font-mono text-indigo-700 bg-white px-1.5 py-0.5 rounded border border-slate-200">backend/checkpoints/witness_store.json</code>) securely retained the genuine sequence anchor, successfully exposing the rollback.
          </p>
        </div>
      )}

      {/* Rollback Detection Result */}
      <AnimatePresence>
        {rollbackResult && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`glass rounded-xl p-5 border ${
              rollbackResult.rollback_detected
                ? 'border-red-500/40 bg-red-500/8'
                : rollbackResult.status === 'NO_CHECKPOINT'
                ? 'border-amber-500/40 bg-amber-500/8'
                : 'border-emerald-500/40 bg-emerald-500/8'
            }`}
          >
            <div className="flex items-start gap-3 mb-4">
              {rollbackResult.rollback_detected ? (
                <AlertOctagon className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
              ) : rollbackResult.status === 'NO_CHECKPOINT' ? (
                <Info className="h-6 w-6 text-amber-500 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle className="h-6 w-6 text-emerald-500 flex-shrink-0 mt-0.5" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className={`font-bold text-sm ${
                      rollbackResult.rollback_detected ? 'text-rose-700'
                      : rollbackResult.status === 'NO_CHECKPOINT' ? 'text-amber-700'
                      : 'text-emerald-700'
                    }`}>
                      {rollbackResult.is_simulation
                        ? 'SIMULATION: ROLLBACK DETECTED (NOT INTACT)'
                        : rollbackResult.status?.replace(/_/g, ' ')}
                    </p>
                    {rollbackResult.is_simulation && (
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                        Simulated Attack
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleGenerateRollbackReport}
                    disabled={generatingReport}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {generatingReport ? 'Generating…' : 'Generate Rollback Report'}
                  </button>
                </div>
                <p className="text-slate-700 text-xs mt-1 leading-relaxed">{rollbackResult.message}</p>
              </div>
            </div>

            {rollbackResult.checkpoint_id && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <MetricCell label="Checkpoint ID" value={rollbackResult.checkpoint_id} mono />
                  <MetricCell label="Trusted Sequence (Witness)" value={rollbackResult.checkpoint_sequence} />
                  <MetricCell label="Trusted Count (Witness)" value={rollbackResult.checkpoint_count} />
                  <MetricCell
                    label={rollbackResult.is_simulation ? "Simulated Sequence" : "Current Max ID"}
                    value={rollbackResult.current_max_id}
                  />
                  <MetricCell
                    label={rollbackResult.is_simulation ? "Simulated Count" : "Current Count"}
                    value={rollbackResult.current_count}
                  />
                  {rollbackResult.actual_db_max_id !== undefined ? (
                    <MetricCell label="Actual MySQL Live Max ID" value={rollbackResult.actual_db_max_id} />
                  ) : (
                    <MetricCell label="Witness Signed" value={rollbackResult.witness_signed ? 'Yes' : 'No (unsigned)'} />
                  )}
                </div>

                {rollbackResult.detection_reason && (
                  <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-1">
                    <p className="font-semibold text-rose-800">Why Rollback Was Detected:</p>
                    <p className="text-slate-700 leading-relaxed">{rollbackResult.detection_reason}</p>
                  </div>
                )}

                {rollbackResult.simulation_note && (
                  <p className="text-[11px] text-slate-500 italic">
                    {rollbackResult.simulation_note}
                  </p>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Latest Witness Summary */}
      {latestCheckpoint && (
        <div className="bg-white rounded-xl p-4 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-slate-900 text-sm font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600" />
            Latest Trusted Witness Checkpoint
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <MetricCell label="Checkpoint ID" value={latestCheckpoint.checkpoint_id} mono />
            <MetricCell label="Sequence Number" value={latestCheckpoint.sequence_number} />
            <MetricCell label="Entry Count" value={latestCheckpoint.chain_entry_count} />
            <MetricCell label="Signed" value={latestCheckpoint.signed_payload !== 'UNSIGNED' ? 'Yes (Ed25519)' : 'No'} />
            <MetricCell label="Signing Key" value={latestCheckpoint.public_key_id || 'None'} mono />
            <MetricCell label="Created" value={latestCheckpoint.created_at ? new Date(latestCheckpoint.created_at).toLocaleString() : 'N/A'} />
          </div>
          <div className="pt-1 border-t border-slate-100">
            <p className="text-slate-500 text-xs font-mono break-all">
              Head Hash: {latestCheckpoint.chain_head_hash}
            </p>
          </div>
        </div>
      )}

      {/* Checkpoint History */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-slate-900 font-semibold text-sm">Checkpoint History</h3>
          <span className="text-xs text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-slate-200">
            {checkpointList.length} checkpoints
          </span>
        </div>
        {loading ? (
          <div className="py-10 flex justify-center items-center">
            <LoadingSpinner size="md" />
          </div>
        ) : error ? (
          <div className="py-10 text-center text-red-400 text-sm px-4">
            {error}
          </div>
        ) : checkpointList.length === 0 ? (
          <div className="py-10 text-center text-slate-500 text-sm">
            No checkpoints created yet. Create your first checkpoint above.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {checkpointList.map((cp) => (
              <div key={cp.id || cp.checkpoint_id} className="px-5 py-3 flex items-center gap-4 hover:bg-slate-50/70 transition-colors">
                <Clock className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-slate-900 text-sm font-mono font-semibold">{cp.checkpoint_id}</p>
                  <p className="text-slate-500 text-xs">
                    seq={cp.sequence_number} · entries={cp.chain_entry_count}
                    · {cp.signed ? `signed by ${cp.public_key_id}` : 'unsigned'}
                  </p>
                </div>
                <span className="text-slate-400 text-xs flex-shrink-0">
                  {cp.created_at ? new Date(cp.created_at).toLocaleString() : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Report Preview Modal */}
      {reportData && (
        <ReportPreviewModal
          report={reportData}
          onClose={() => setReportData(null)}
          onDownload={handleDownloadRollbackPdf}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// FEATURE B — RE-SAVE ANALYSIS TAB
// ══════════════════════════════════════════════════════

function ResaveTab() {
  const [files, setFiles] = useState([])
  const [selectedFileId, setSelectedFileId] = useState('')
  const [newFile, setNewFile] = useState(null)
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [registeringDeriv, setRegisteringDeriv] = useState(false)
  const [derivatives, setDerivatives] = useState([])
  const [reportData, setReportData] = useState(null)
  const [generatingReport, setGeneratingReport] = useState(false)

  const handleGenerateResaveReport = async () => {
    if (!result) return
    setGeneratingReport(true)
    try {
      const payload = { ...result, original_file_id: selectedFileId }
      const res = await provenanceguardApi.generateResaveReport(payload)
      setReportData(res.data)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to generate Re-Save Report')
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleDownloadResavePdf = async () => {
    if (!result) return
    try {
      const payload = { ...result, original_file_id: selectedFileId }
      const res = await provenanceguardApi.downloadResavePdf(payload)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ReSave_Report_${reportData?.report_id || Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Re-Save Report PDF downloaded')
    } catch (err) {
      toast.error('Failed to download PDF')
    }
  }

  useEffect(() => {
    sourcemarkApi.getFiles().then(r => {
      const list = Array.isArray(r?.data) ? r.data : (Array.isArray(r?.data?.files) ? r.data.files : [])
      setFiles(list)
    }).catch(() => setFiles([]))
  }, [])

  const handleAnalyze = async () => {
    if (!selectedFileId || !newFile) {
      toast.error('Select an original registered file and upload the new version')
      return
    }
    const fd = new FormData()
    fd.append('file', newFile)
    fd.append('original_file_id', selectedFileId)
    setAnalyzing(true)
    setResult(null)
    try {
      const res = await provenanceguardApi.analyzeResave(fd)
      setResult(res.data)
      const cls = res.data.classification
      if (cls === 'EXACT_MATCH') toast.success('Exact Match — files are bit-for-bit identical')
      else if (cls === 'POSSIBLE_DERIVATIVE') toast('Possible Derivative / Re-Save detected', { icon: '🔍' })
      else if (cls === 'CONTENT_MODIFIED') toast.error('Content Modified — significant changes detected')
      else toast(`Classification: ${cls}`, { icon: '📊' })
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Analysis failed')
    } finally {
      setAnalyzing(false)
    }
  }

  const handleRegisterDerivative = async () => {
    if (!selectedFileId || !newFile) return
    const relType = prompt('Relationship type (RESAVE / RESIZE / RECOMPRESS / FORMAT_CONVERT / UNKNOWN):', 'RESAVE')
    if (!relType) return
    const fd = new FormData()
    fd.append('file', newFile)
    fd.append('original_file_id', selectedFileId)
    fd.append('relationship_type', relType.toUpperCase())
    fd.append('authorized_by', 'admin')
    setRegisteringDeriv(true)
    try {
      const res = await provenanceguardApi.registerDerivative(fd)
      toast.success(`Derivative registered: ID ${res.data.derivative_file_id}`)
      // Refresh derivatives list
      const dRes = await provenanceguardApi.getDerivatives(selectedFileId)
      setDerivatives(Array.isArray(dRes?.data?.derivatives) ? dRes.data.derivatives : (Array.isArray(dRes?.data) ? dRes.data : []))
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Derivative registration failed')
    } finally {
      setRegisteringDeriv(false)
    }
  }

  const handleFileIdChange = async (id) => {
    setSelectedFileId(id)
    setResult(null)
    setDerivatives([])
    if (id) {
      try {
        const dRes = await provenanceguardApi.getDerivatives(id)
        setDerivatives(Array.isArray(dRes?.data?.derivatives) ? dRes.data.derivatives : (Array.isArray(dRes?.data) ? dRes.data : []))
      } catch {}
    }
  }

  const cls = result?.classification
  const clsColors = {
    EXACT_MATCH: 'border-emerald-500/30 bg-emerald-500/5',
    CONTENT_SIMILAR: 'border-blue-500/30 bg-blue-500/5',
    POSSIBLE_DERIVATIVE: 'border-amber-500/30 bg-amber-500/5',
    CONTENT_MODIFIED: 'border-red-500/30 bg-red-500/5',
    UNABLE_TO_DETERMINE: 'border-slate-500/30 bg-slate-500/5',
  }
  const clsTextColors = {
    EXACT_MATCH: 'text-emerald-400',
    CONTENT_SIMILAR: 'text-blue-400',
    POSSIBLE_DERIVATIVE: 'text-amber-400',
    CONTENT_MODIFIED: 'text-red-400',
    UNABLE_TO_DETERMINE: 'text-slate-400',
  }

  return (
    <div className="space-y-5">
      <TrustNotice
        title="Dual-Layer Verification"
        text="Layer 1 (SHA-256) is the authoritative cryptographic check. Layer 2 adds content-specific analysis and perceptual comparison. A high similarity score does NOT confirm authenticity. Only an exact SHA-256 match constitutes verification."
      />

      {/* Controls */}
      <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-4">
        <h3 className="text-slate-900 font-semibold text-sm flex items-center gap-2">
          <FileSearch className="h-4 w-4 text-indigo-600" />
          Analyze a File Against Its Registered Original
        </h3>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Step 1: Select the Registered Original
          </label>
          <select
            value={selectedFileId}
            onChange={(e) => handleFileIdChange(e.target.value)}
            className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-violet-500/50"
          >
            <option value="">— Choose a registered original file —</option>
            {(Array.isArray(files) ? files : []).map((f) => (
              <option key={f.id} value={f.id}>
                {f.filename} ({((f.file_size || 0) / 1024).toFixed(1)} KB)
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1.5">
            Step 2: Upload the New Version to Analyze
          </label>
          <label className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
            newFile ? 'border-violet-500/50 bg-violet-500/5' : 'border-slate-200 hover:border-violet-500/30'
          }`}>
            {newFile
              ? <span className="text-indigo-700 text-sm">{newFile.name}</span>
              : <span className="text-slate-500 text-sm">Click to select the new file version</span>
            }
            <input type="file" className="hidden" onChange={(e) => { setNewFile(e.target.files[0]); setResult(null) }} />
          </label>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleAnalyze}
            disabled={analyzing || !selectedFileId || !newFile}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs text-sm font-medium transition-colors disabled:opacity-50"
          >
            {analyzing ? <LoadingSpinner size="sm" /> : <FileSearch className="h-4 w-4" />}
            {analyzing ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
      </div>

      {/* Analysis Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`glass rounded-xl p-5 border space-y-4 ${clsColors[cls] || 'border-slate-200'}`}
          >
            {/* Classification Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
              <div>
                <p className={`text-lg font-bold ${clsTextColors[cls] || 'text-slate-700'}`}>
                  {result.classification_label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 max-w-xl leading-relaxed">
                  {result.classification_explanation}
                </p>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                {result.comparison?.similarity_percentage !== undefined && (
                  <div className="text-right">
                    <p className="text-2xl font-bold text-indigo-700">
                      {result.comparison.similarity_percentage.toFixed(1)}%
                    </p>
                    <p className="text-xs text-slate-400">Similarity</p>
                  </div>
                )}
                <button
                  onClick={handleGenerateResaveReport}
                  disabled={generatingReport}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {generatingReport ? 'Generating…' : 'Generate Re-Save Report'}
                </button>
              </div>
            </div>

            {/* Layer 1 — Exact Integrity */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Layer 1 — Exact SHA-256 Integrity</p>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                result.is_exact_hash_match
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300'
                  : 'bg-red-500/10 border-red-500/25 text-red-300'
              }`}>
                {result.is_exact_hash_match
                  ? <><CheckCircle className="h-4 w-4" /> EXACT MATCH — SHA-256 identical</>
                  : <><XCircle className="h-4 w-4" /> MODIFIED — SHA-256 differs (byte-level change confirmed)</>
                }
              </div>
              {result.original_filename && <HashRow label="Original File" value={result.original_filename} />}
              {result.new_filename && <HashRow label="New File" value={result.new_filename} />}
              <HashRow label="Original Hash" value={result.original_hash} />
              <HashRow label="New Hash" value={result.new_hash} />
            </div>

            {/* Presentation Slide Breakdown (when comparing PowerPoint .pptx presentations) */}
            {result.comparison?.structural_details?.slide_details && (
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-indigo-700 uppercase tracking-wide">
                    Presentation Slide Breakdown
                  </p>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {result.comparison.structural_details.up_slides_count || result.comparison.structural_details.orig_slides_count || 0} Total Slides
                  </span>
                </div>

                {/* 4 Slide Count Badges */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-emerald-400 font-semibold uppercase">Unchanged</p>
                    <p className="text-lg font-bold text-emerald-300 mt-0.5">
                      {result.comparison.structural_details.unchanged_slides_count ?? 0}
                    </p>
                  </div>
                  <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-amber-400 font-semibold uppercase">Modified</p>
                    <p className="text-lg font-bold text-amber-300 mt-0.5">
                      {result.comparison.structural_details.modified_slides_count ?? 0}
                    </p>
                  </div>
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-blue-400 font-semibold uppercase">Added</p>
                    <p className="text-lg font-bold text-blue-300 mt-0.5">
                      {result.comparison.structural_details.added_slides_count ?? 0}
                    </p>
                  </div>
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2.5 text-center">
                    <p className="text-[10px] text-red-400 font-semibold uppercase">Removed</p>
                    <p className="text-lg font-bold text-red-300 mt-0.5">
                      {result.comparison.structural_details.removed_slides_count ?? 0}
                    </p>
                  </div>
                </div>

                {/* Expandable Slide-by-Slide Comparison */}
                <SlideComparisonViewer slides={result.comparison.structural_details.slide_details} />
              </div>
            )}

            {/* Layer 2 — Content Analysis */}
            {result.comparison && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Layer 2 — Content Analysis</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  <MetricCell label="Method" value={result.comparison.comparison_method} />
                  <MetricCell label="Change" value={`${(result.comparison.change_percentage || 0).toFixed(2)}%`} />
                  <MetricCell label="Similarity" value={`${(result.comparison.similarity_percentage || 0).toFixed(2)}%`} />
                  {result.comparison.affected_pages?.length > 0 && (
                    <MetricCell label="Affected Pages" value={result.comparison.affected_pages.join(', ')} />
                  )}
                  {result.perceptual_hash_orig && (
                    <MetricCell label="pHash Orig" value={result.perceptual_hash_orig} mono />
                  )}
                  {result.perceptual_distance !== null && result.perceptual_distance !== undefined && (
                    <MetricCell label="pHash Distance" value={result.perceptual_distance} />
                  )}
                </div>

                {/* Similarity Bar */}
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Similarity</span>
                    <span>{(result.comparison.similarity_percentage || 0).toFixed(2)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-2 border border-slate-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        result.is_exact_hash_match ? 'bg-emerald-500'
                        : result.comparison.similarity_percentage >= 95 ? 'bg-blue-500'
                        : result.comparison.similarity_percentage >= 70 ? 'bg-amber-500'
                        : 'bg-red-500'
                      }`}
                      style={{ width: `${Math.max(2, Math.min(100, result.comparison.similarity_percentage || 0))}%` }}
                    />
                  </div>
                </div>

                {/* Diff Details */}
                {!result.is_exact_hash_match && (
                  <DiffSection
                    added={result.comparison.added}
                    removed={result.comparison.removed}
                    modified={result.comparison.modified}
                  />
                )}
              </div>
            )}

            {/* Register as Derivative */}
            {!result.is_exact_hash_match && cls !== 'UNABLE_TO_DETERMINE' && (
              <div className="pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400 mb-2">
                  If this version is authorized, you can register it as a derivative linked to the original.
                </p>
                <button
                  onClick={handleRegisterDerivative}
                  disabled={registeringDeriv}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border-indigo-200 hover:bg-violet-600/50 text-violet-200 border border-violet-500/30 text-xs font-medium transition-colors"
                >
                  <Link className="h-3.5 w-3.5" />
                  {registeringDeriv ? 'Registering…' : 'Register as Authorized Derivative'}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Derivatives List */}
      {selectedFileId && (
        <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-slate-900 font-semibold text-sm">Registered Derivatives</h3>
          </div>
          {(!Array.isArray(derivatives) || derivatives.length === 0) ? (
            <div className="py-8 text-center text-slate-500 text-sm">No authorized derivatives for this file.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {(Array.isArray(derivatives) ? derivatives : []).map((d) => (
                <div key={d.id} className="px-5 py-3 flex items-center gap-4">
                  <Link className="h-4 w-4 text-amber-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 text-sm">
                      {d.relationship_type} derivative
                      {d.classification && <span className="text-slate-400 text-xs ml-2">({d.classification})</span>}
                    </p>
                    <p className="text-slate-500 text-xs">
                      by {d.authorized_by} · {d.similarity_percentage ? `${d.similarity_percentage.toFixed(1)}% similar` : ''}
                    </p>
                  </div>
                  <span className="text-slate-400 text-xs">{d.created_at ? new Date(d.created_at).toLocaleString() : ''}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Re-Save Report Modal */}
      {reportData && (
        <ReportPreviewModal
          report={reportData}
          onClose={() => setReportData(null)}
          onDownload={handleDownloadResavePdf}
        />
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════
// FEATURE C — SIGNING KEY SECURITY TAB
// ══════════════════════════════════════════════════════

function KeysTab() {
  const [keys, setKeys] = useState([])
  const [signatures, setSignatures] = useState([])
  const [loading, setLoading] = useState(false)
  const [activeKeyPanel, setActiveKeyPanel] = useState(null)

  // Sign form
  const [signMessage, setSignMessage] = useState('')
  const [signing, setSigning] = useState(false)
  const [lastSig, setLastSig] = useState(null)

  // Verify form
  const [verifySigId, setVerifySigId] = useState('')
  const [verifyMsg, setVerifyMsg] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)

  // Compromise form
  const [compromiseKey, setCompromiseKey] = useState('')
  const [compromiseReason, setCompromiseReason] = useState('')
  const [compromiseWindowStart, setCompromiseWindowStart] = useState('')
  const [compromiseWindowEnd, setCompromiseWindowEnd] = useState('')
  const [compromising, setCompromising] = useState(false)
  const [reportData, setReportData] = useState(null)
  const [generatingReport, setGeneratingReport] = useState(false)

  const handleGenerateKeyReport = async (targetKeyId, verResult = null) => {
    const kId = targetKeyId || activeKey?.key_id
    if (!kId) {
      toast.error('Select or specify a Key ID first')
      return
    }
    setGeneratingReport(true)
    try {
      const payload = {
        key_id: kId,
        verification_result: verResult?.verification_result || verifyResult?.verification_result || 'NOT_VERIFIED',
        signature_id: verResult?.signature_id || verifySigId || null,
        message_hash: lastSig?.message_hash || null,
      }
      const res = await provenanceguardApi.generateKeysReport(payload)
      setReportData(res.data)
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Failed to generate Signing Key Report')
    } finally {
      setGeneratingReport(false)
    }
  }

  const handleDownloadKeyPdf = async () => {
    if (!reportData?.key_id) return
    try {
      const payload = {
        key_id: reportData.key_id,
        verification_result: reportData.signature_verification,
        signature_id: reportData.signature_id,
        message_hash: reportData.message_hash,
      }
      const res = await provenanceguardApi.downloadKeysPdf(payload)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `SigningKey_Report_${reportData?.report_id || Date.now()}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Signing Key Report PDF downloaded')
    } catch (err) {
      toast.error('Failed to download PDF')
    }
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [kRes, sRes] = await Promise.allSettled([
        provenanceguardApi.listKeys(),
        provenanceguardApi.listSignatures(),
      ])
      if (kRes.status === 'fulfilled') {
        const kData = kRes.value?.data
        setKeys(Array.isArray(kData) ? kData : (kData?.keys || kData?.data || []))
      }
      if (sRes.status === 'fulfilled') {
        const sData = sRes.value?.data
        setSignatures(Array.isArray(sData) ? sData : (sData?.signatures || sData?.data || []))
      }
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleGenerate = async () => {
    const owner = prompt('Key owner / issuer name:', 'TrustSphere AI') || 'TrustSphere AI'
    try {
      const res = await provenanceguardApi.generateKey(owner)
      toast.success(`Key ${res.data.key.key_id} generated`)
      await refresh()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Key generation failed')
    }
  }

  const handleRotate = async (keyId) => {
    try {
      const res = await provenanceguardApi.rotateKey(keyId)
      toast.success(`Rotated: ${res.data.old_key.key_id} → ${res.data.new_key.key_id}`)
      await refresh()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Rotation failed')
    }
  }

  const handleRevoke = async (keyId) => {
    const reason = prompt('Reason for revocation:', 'Revoked by administrator')
    if (!reason) return
    try {
      await provenanceguardApi.revokeKey(keyId, reason)
      toast.success(`Key ${keyId} revoked`)
      await refresh()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Revocation failed')
    }
  }

  const handleSign = async () => {
    if (!signMessage.trim()) { toast.error('Enter a message to sign'); return }
    setSigning(true)
    try {
      const res = await provenanceguardApi.signMessage({ message: signMessage, actor: 'user' })
      setLastSig(res.data)
      toast.success(`Signed → ${res.data.signature_id}`)
      await refresh()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Signing failed')
    } finally {
      setSigning(false)
    }
  }

  const handleVerify = async () => {
    if (!verifySigId.trim()) { toast.error('Enter a Signature ID to verify'); return }
    setVerifying(true)
    setVerifyResult(null)
    try {
      const res = await provenanceguardApi.verifySignature({
        signature_id: verifySigId,
        original_message: verifyMsg || null,
      })
      setVerifyResult(res.data)
      const r = res.data.verification_result
      if (r === 'VALID') toast.success('Signature VALID')
      else if (r === 'INVALID_SIGNATURE') toast.error('INVALID SIGNATURE — cryptographic verification failed')
      else if (r === 'SIGNED_AFTER_REVOCATION') toast.error('Signed AFTER revocation — suspect')
      else if (r === 'POSSIBLY_COMPROMISED') toast.error('Within compromise window — POSSIBLY COMPROMISED')
      else toast(r, { icon: '⚠️' })
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Verification failed')
    } finally {
      setVerifying(false)
    }
  }

  const handleCompromise = async () => {
    if (!compromiseKey) { toast.error('Select a key to report'); return }
    setCompromising(true)
    try {
      await provenanceguardApi.reportCompromise({
        key_id: compromiseKey,
        reason: compromiseReason || 'Key compromise reported',
        window_start: compromiseWindowStart || null,
        window_end: compromiseWindowEnd || null,
      })
      toast.success('Key compromise reported')
      await refresh()
    } catch (err) {
      toast.error(err?.response?.data?.detail || 'Compromise report failed')
    } finally {
      setCompromising(false)
      setCompromiseKey('')
    }
  }

  const verifyResultColors = {
    VALID: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
    INVALID_SIGNATURE: 'border-red-500/30 bg-red-500/5 text-red-400',
    SIGNED_AFTER_REVOCATION: 'border-red-500/30 bg-red-500/5 text-red-400',
    POSSIBLY_COMPROMISED: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
    KEY_NOT_FOUND: 'border-slate-500/30 bg-slate-500/5 text-slate-400',
    HISTORICAL_UNKNOWN: 'border-slate-500/30 bg-slate-500/5 text-slate-400',
  }

  const keysList = Array.isArray(keys) ? keys : []
  const signaturesList = Array.isArray(signatures) ? signatures : []
  const activeKey = keysList.find(k => k.status === 'ACTIVE')

  return (
    <div className="space-y-5">
      <TrustNotice
        title="Private Key Security"
        text="Private keys are stored ONLY on the server filesystem (backend/keys/private/). They are never stored in MySQL, never returned by any API, and never sent to this browser. Only public keys are visible here. For production: use an HSM or cloud secrets manager."
      />

      {/* Key Registry */}
      <div className="space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-slate-900 font-semibold text-sm">Key Registry</h3>
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs text-xs font-medium transition-colors"
            >
              <Key className="h-3.5 w-3.5" />
              Generate New Key
            </button>
            <button onClick={refresh} disabled={loading} className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 bg-white border border-slate-200 shadow-2xs">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {keysList.length === 0 ? (
          <div className="glass rounded-xl py-10 text-center text-slate-500 text-sm border border-violet-500/15">
            No signing keys yet. Generate your first Ed25519 key pair.
          </div>
        ) : (
          <div className="space-y-3">
            {keysList.map((key) => (
              <KeyCard
                key={key.key_id}
                k={key}
                expanded={activeKeyPanel === key.key_id}
                onToggle={() => setActiveKeyPanel(activeKeyPanel === key.key_id ? null : key.key_id)}
                onRotate={() => handleRotate(key.key_id)}
                onRevoke={() => handleRevoke(key.key_id)}
                onGenerateReport={() => handleGenerateKeyReport(key.key_id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sign & Verify Panel */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Sign */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-slate-900 font-semibold text-sm flex items-center gap-2">
            <PenTool className="h-4 w-4 text-indigo-600" />
            Sign a Message
          </h3>
          {activeKey ? (
            <p className="text-xs text-slate-400">
              Signing with: <span className="text-indigo-700 font-mono">{activeKey.key_id}</span>
            </p>
          ) : (
            <p className="text-xs text-amber-400">⚠ No ACTIVE key — generate one first.</p>
          )}
          <textarea
            rows={3}
            value={signMessage}
            onChange={(e) => setSignMessage(e.target.value)}
            placeholder="Enter message or data to sign…"
            className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-violet-500/50"
          />
          <button
            onClick={handleSign}
            disabled={signing || !activeKey}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs text-xs font-medium transition-colors disabled:opacity-50 w-full justify-center"
          >
            {signing ? <LoadingSpinner size="sm" /> : <PenTool className="h-3.5 w-3.5" />}
            {signing ? 'Signing…' : 'Sign Message'}
          </button>
          {lastSig && (
            <div className="bg-white/3 rounded-lg p-3 border border-slate-100 space-y-1 text-xs">
              <p className="text-slate-400">Signature ID:</p>
              <p className="text-indigo-700 font-mono break-all">{lastSig.signature_id}</p>
              <p className="text-slate-400 mt-1">Hash:</p>
              <p className="text-slate-700 font-mono break-all">{lastSig.message_hash}</p>
            </div>
          )}
        </div>

        {/* Verify */}
        <div className="bg-white rounded-xl p-5 border border-slate-200/80 shadow-xs space-y-3">
          <h3 className="text-slate-900 font-semibold text-sm flex items-center gap-2">
            <Eye className="h-4 w-4 text-emerald-400" />
            Verify a Signature
          </h3>
          <input
            value={verifySigId}
            onChange={(e) => setVerifySigId(e.target.value)}
            placeholder="Signature ID (e.g. SIG-XXXXXXXXXXXXXXXX)"
            className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-500/50"
          />
          <textarea
            rows={2}
            value={verifyMsg}
            onChange={(e) => setVerifyMsg(e.target.value)}
            placeholder="Original message (required for cryptographic verification)"
            className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-violet-500/50"
          />
          <button
            onClick={handleVerify}
            disabled={verifying}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs text-xs font-medium transition-colors disabled:opacity-50 w-full justify-center"
          >
            {verifying ? <LoadingSpinner size="sm" /> : <Eye className="h-3.5 w-3.5" />}
            {verifying ? 'Verifying…' : 'Verify Signature'}
          </button>
          {verifyResult && (
            <div className={`rounded-lg p-3 border text-xs space-y-2 ${verifyResultColors[verifyResult.verification_result] || 'border-slate-200 text-slate-700'}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="font-bold">{verifyResult.verification_result}</p>
                <button
                  type="button"
                  onClick={() => handleGenerateKeyReport(verifyResult.key_id, verifyResult)}
                  disabled={generatingReport}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-semibold transition-colors shadow-2xs"
                >
                  <FileText className="h-3 w-3" />
                  Generate Report
                </button>
              </div>
              <p className="text-slate-700 leading-relaxed">{verifyResult.explanation}</p>
              <div className="grid grid-cols-2 gap-1 pt-1 border-t border-slate-200">
                <MetricCell label="Key ID" value={verifyResult.key_id} mono />
                <MetricCell label="Key Status" value={verifyResult.key_status} />
                <MetricCell label="Owner" value={verifyResult.key_owner} />
                <MetricCell label="Signed At" value={verifyResult.signed_at ? new Date(verifyResult.signed_at).toLocaleString() : '—'} />
                <MetricCell label="Crypto Valid" value={verifyResult.cryptographic_valid ? 'Yes' : 'No'} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report Compromise */}
      <div className="glass rounded-xl p-5 border border-red-500/20 bg-red-500/3 space-y-3">
        <h3 className="text-slate-900 font-semibold text-sm flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-red-400" />
          Report Key Compromise
        </h3>
        <p className="text-xs text-slate-400">
          Use when a signing key has been stolen or exposed. Signatures created within the declared
          compromise window will be flagged <span className="text-amber-300">POSSIBLY_COMPROMISED</span> during verification.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Compromised Key</label>
            <select
              value={compromiseKey}
              onChange={(e) => setCompromiseKey(e.target.value)}
              className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-800 focus:outline-none focus:border-red-500/50"
            >
              <option value="">— Select a key —</option>
              {keysList.filter(k => !['REVOKED','COMPROMISED'].includes(k.status)).map(k => (
                <option key={k.key_id} value={k.key_id}>{k.key_id} ({k.owner}) [{k.status}]</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Reason</label>
            <input
              value={compromiseReason}
              onChange={(e) => setCompromiseReason(e.target.value)}
              placeholder="e.g. Private key file exposed in breach"
              className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Window Start (ISO-8601, optional)</label>
            <input
              type="datetime-local"
              value={compromiseWindowStart}
              onChange={(e) => setCompromiseWindowStart(e.target.value)}
              className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Window End (optional, defaults to now)</label>
            <input
              type="datetime-local"
              value={compromiseWindowEnd}
              onChange={(e) => setCompromiseWindowEnd(e.target.value)}
              className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500/50"
            />
          </div>
        </div>
        <button
          onClick={handleCompromise}
          disabled={compromising || !compromiseKey}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          <AlertOctagon className="h-3.5 w-3.5" />
          {compromising ? 'Reporting…' : 'Report Key as Compromised'}
        </button>
      </div>

      {/* Signature Log */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-slate-900 font-semibold text-sm">Signature Records</h3>
          <span className="text-xs text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-slate-200">
            {signatures.length}
          </span>
        </div>
        {signaturesList.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm">No signatures yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {signaturesList.map((s) => (
              <div key={s.signature_id} className="px-5 py-3 flex items-center gap-4">
                <PenTool className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-mono">{s.signature_id}</p>
                  <p className="text-slate-500 text-xs">key: {s.key_id} · {s.entity_type || 'manual'}</p>
                </div>
                <span className="text-slate-400 text-xs flex-shrink-0">
                  {s.signed_at ? new Date(s.signed_at).toLocaleString() : '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Signing Key Report Modal */}
      {reportData && (
        <ReportPreviewModal
          report={reportData}
          onClose={() => setReportData(null)}
          onDownload={handleDownloadKeyPdf}
        />
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────
// Shared Sub-Components
// ──────────────────────────────────────────────────────

function KeyCard({ k, expanded, onToggle, onRotate, onRevoke, onGenerateReport }) {
  const statusColors = {
    ACTIVE: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    ROTATED: 'bg-slate-500/15 text-slate-700 border-slate-500/30',
    REVOKED: 'bg-red-500/15 text-red-300 border-red-500/30',
    COMPROMISED: 'bg-red-600/20 text-red-300 border-red-600/40',
    EXPIRED: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  }

  return (
    <div className={`glass rounded-xl border transition-colors ${
      k.status === 'ACTIVE' ? 'border-emerald-500/20' : 'border-slate-200'
    }`}>
      <div className="px-5 py-3 flex items-center gap-4">
        <Key className={`h-4 w-4 flex-shrink-0 ${k.status === 'ACTIVE' ? 'text-emerald-400' : 'text-slate-400'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-slate-900 text-sm font-mono font-semibold">{k.key_id}</p>
            <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${statusColors[k.status] || 'bg-white/5 text-slate-700 border-slate-200'}`}>
              {k.status}
            </span>
          </div>
          <p className="text-slate-400 text-xs">{k.owner} · {k.algorithm}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {k.status === 'ACTIVE' && (
            <button
              onClick={onRotate}
              title="Rotate key"
              className="p-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
          {k.status === 'ACTIVE' && (
            <button
              onClick={onRevoke}
              title="Revoke key"
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Lock className="h-3.5 w-3.5" />
            </button>
          )}
          {onGenerateReport && (
            <button
              onClick={onGenerateReport}
              title="Generate Signing Key Report"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold border border-indigo-200 transition-colors shadow-2xs"
            >
              <FileText className="h-3.5 w-3.5" />
              Report
            </button>
          )}
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 pt-1 space-y-2 border-t border-slate-100">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <MetricCell label="Created" value={k.created_at ? new Date(k.created_at).toLocaleString() : '—'} />
                {k.rotated_at && <MetricCell label="Rotated At" value={new Date(k.rotated_at).toLocaleString()} />}
                {k.revoked_at && <MetricCell label="Revoked At" value={new Date(k.revoked_at).toLocaleString()} />}
                {k.compromised_at && <MetricCell label="Compromised At" value={new Date(k.compromised_at).toLocaleString()} />}
                {k.compromise_window_start && <MetricCell label="Window Start" value={new Date(k.compromise_window_start).toLocaleString()} />}
                {k.compromise_window_end && <MetricCell label="Window End" value={new Date(k.compromise_window_end).toLocaleString()} />}
              </div>
              {k.status_reason && (
                <p className="text-xs text-amber-300">Reason: {k.status_reason}</p>
              )}
              <div className="pt-1">
                <p className="text-xs text-slate-400 mb-1">Public Key (Ed25519):</p>
                <pre className="text-[10px] text-slate-500 font-mono bg-white/3 p-2 rounded border border-slate-100 overflow-x-auto whitespace-pre-wrap break-all">
                  {k.public_key_pem}
                </pre>
                <p className="text-[11px] text-slate-500 mt-1 italic">{k.private_key}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function SlideComparisonViewer({ slides = [] }) {
  const [expanded, setExpanded] = useState(true)
  const [activeSlide, setActiveSlide] = useState(null)

  if (!Array.isArray(slides) || slides.length === 0) return null

  return (
    <div className="rounded-xl border border-violet-500/20 bg-slate-900/60 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 border-indigo-100 hover:bg-violet-600/15 border-b border-slate-100 transition-colors text-left"
      >
        <span className="text-xs font-semibold text-slate-800 flex items-center gap-2">
          Slide-by-Slide Content Comparison ({slides.length} slides)
        </span>
        {expanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="p-3 space-y-2">
          {slides.map((s, idx) => {
            const isMod = s.status === 'MODIFIED'
            const isAdded = s.status === 'ADDED'
            const isRem = s.status === 'REMOVED'
            const isUnchanged = s.status === 'UNCHANGED'
            const isSelected = activeSlide === idx || (activeSlide === null && !isUnchanged)

            const statusBadge = isUnchanged ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle className="h-3 w-3" /> Unchanged
              </span>
            ) : isMod ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> Modified ({s.similarity_percentage}% sim)
              </span>
            ) : isAdded ? (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/15 text-blue-300 border border-blue-500/30">
                + Added Slide
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-red-500/15 text-red-300 border border-red-500/30">
                - Removed Slide
              </span>
            )

            return (
              <div
                key={idx}
                className={`rounded-lg border text-xs overflow-hidden transition-all ${
                  isMod ? 'border-amber-500/25 bg-amber-500/5'
                  : isAdded ? 'border-blue-500/25 bg-blue-500/5'
                  : isRem ? 'border-red-500/25 bg-red-500/5'
                  : 'border-slate-100 bg-white/2 opacity-75'
                }`}
              >
                <div
                  onClick={() => setActiveSlide(isSelected ? -1 : idx)}
                  className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-white/5 select-none"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="font-mono text-slate-400 text-[11px] font-bold">
                      {s.slide_number ? `Slide ${s.slide_number}` : `Orig Slide ${s.orig_slide_number}`}
                    </span>
                    <span className="text-slate-800 truncate font-medium">
                      {s.title || '(Untitled Slide)'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {statusBadge}
                    {isSelected ? <ChevronUp className="h-3.5 w-3.5 text-slate-400" /> : <ChevronDown className="h-3.5 w-3.5 text-slate-400" />}
                  </div>
                </div>

                {isSelected && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-100 space-y-2">
                    {/* Differences pill overview */}
                    {s.diff_snippets?.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[10px] uppercase font-semibold text-slate-400">Detected Changes:</span>
                        <div className="flex flex-wrap gap-1">
                          {(Array.isArray(s.diff_snippets) ? s.diff_snippets : []).map((d, dIdx) => (
                            <span key={dIdx} className="px-2 py-0.5 rounded bg-slate-800 text-[11px] font-mono border border-slate-200">
                              {d.type === 'replace' && (
                                <>
                                  <span className="text-red-300 line-through mr-1">{d.original}</span>
                                  <span className="text-slate-500 mr-1">→</span>
                                  <span className="text-emerald-300 font-semibold">{d.modified}</span>
                                </>
                              )}
                              {d.type === 'delete' && <span className="text-red-300">Removed: '{d.original}'</span>}
                              {d.type === 'add' && <span className="text-emerald-300">Added: '{d.modified}'</span>}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Side-by-side or stacked text preview */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px] pt-1">
                      <div className="bg-black/30 rounded p-2 border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-semibold mb-1 uppercase flex items-center justify-between">
                          <span>Original Text</span>
                          {s.orig_slide_number && <span className="font-mono text-slate-500">Slide {s.orig_slide_number}</span>}
                        </p>
                        <p className="font-mono text-slate-700 whitespace-pre-wrap leading-relaxed break-words">
                          {s.original_text || <span className="text-slate-500 italic">(none)</span>}
                        </p>
                      </div>
                      <div className="bg-black/30 rounded p-2 border border-slate-100">
                        <p className="text-[10px] text-slate-400 font-semibold mb-1 uppercase flex items-center justify-between">
                          <span>Modified Text</span>
                          {s.slide_number && <span className="font-mono text-slate-500">Slide {s.slide_number}</span>}
                        </p>
                        <p className="font-mono text-slate-700 whitespace-pre-wrap leading-relaxed break-words">
                          {s.modified_text || <span className="text-slate-500 italic">(none)</span>}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function DiffSection({ added = [], removed = [], modified = [] }) {
  const safeAdded = Array.isArray(added) ? added : []
  const safeRemoved = Array.isArray(removed) ? removed : []
  const safeModified = Array.isArray(modified) ? modified : []
  if (!safeAdded.length && !safeRemoved.length && !safeModified.length) return null
  return (
    <div className="space-y-2">
      {safeAdded.length > 0 && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-xs font-semibold text-emerald-400 mb-1.5">+ Added ({safeAdded.length})</p>
          {safeAdded.slice(0, 5).map((item, i) => (
            <div key={i} className="text-xs text-emerald-200 font-mono bg-emerald-950/30 px-2 py-1 rounded mb-1 break-all">
              {String(item)}
            </div>
          ))}
        </div>
      )}
      {safeRemoved.length > 0 && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-xs font-semibold text-red-400 mb-1.5">- Removed ({safeRemoved.length})</p>
          {safeRemoved.slice(0, 5).map((item, i) => (
            <div key={i} className="text-xs text-red-200 font-mono bg-red-950/30 px-2 py-1 rounded mb-1 break-all">
              {String(item)}
            </div>
          ))}
        </div>
      )}
      {safeModified.length > 0 && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
          <p className="text-xs font-semibold text-amber-400 mb-1.5">~ Modified ({safeModified.length})</p>
          {safeModified.slice(0, 3).map((m, i) => (
            <div key={i} className="mb-2 text-xs">
              <span className="text-slate-400 font-mono">[{m.section || `Section ${i + 1}`}]</span>
              <div className="text-red-300 font-mono bg-red-950/30 px-2 py-1 rounded border border-red-500/10 mt-0.5 break-all line-through opacity-80">{m.original}</div>
              <div className="text-emerald-300 font-mono bg-emerald-950/30 px-2 py-1 rounded border border-emerald-500/10 mt-0.5 break-all">{m.modified}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MetricCell({ label, value, mono = false }) {
  return (
    <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-200">
      <p className="text-slate-500 text-[10px] font-medium mb-0.5">{label}</p>
      <p className={`text-slate-900 text-xs font-semibold break-all ${mono ? 'font-mono' : ''}`}>
        {value === null || value === undefined ? '—' : String(value)}
      </p>
    </div>
  )
}

function HashRow({ label, value }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-slate-500 w-28 flex-shrink-0 font-medium">{label}:</span>
      <span className="text-slate-800 font-mono break-all font-medium">{value}</span>
    </div>
  )
}

function TrustNotice({ title, text }) {
  return (
    <div className="flex gap-3 px-4 py-3 rounded-xl border border-blue-200 bg-blue-50/70 text-xs shadow-2xs">
      <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-blue-900 font-semibold mb-0.5">{title}</p>
        <p className="text-slate-600 leading-relaxed">{text}</p>
      </div>
    </div>
  )
}

// Need to import useCallback
// eslint-disable-next-line no-unused-vars
const { useCallback: _uc } = { useCallback: () => {} }



// ══════════════════════════════════════════════════════
// REPORT PREVIEW MODAL COMPONENT
// ══════════════════════════════════════════════════════

function ReportPreviewModal({ report, onClose, onDownload }) {
  if (!report) return null

  const isSim = report.is_simulation
  const reportType = report.report_type || 'Security Report'

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-50/90 via-violet-50/70 to-blue-50/90 border-b border-indigo-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-slate-900 font-bold text-sm tracking-tight">{reportType}</h3>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-semibold border border-indigo-200">
                  {report.report_id}
                </span>
              </div>
              <p className="text-slate-500 text-xs">
                Generated {report.generated_at_ist} · {report.generated_by}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 text-xs">
          {/* Simulation Disclaimer Banner */}
          {isSim && (
            <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50 text-amber-900 space-y-1">
              <div className="flex items-center gap-2 font-bold uppercase tracking-wide">
                <AlertOctagon className="h-4 w-4 text-amber-700" />
                SIMULATION — NOT A REAL DATABASE ROLLBACK
              </div>
              <p className="text-slate-700 leading-relaxed">
                This report demonstrates rollback detection using simulated in-memory state. Zero actual MySQL audit or checkpoint records were altered or deleted.
              </p>
            </div>
          )}

          {/* Status summary banner */}
          <div className="p-3.5 rounded-xl border bg-slate-50 border-slate-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-900 text-sm">
                {report.summary_title || report.classification_label || report.key_status}
              </span>
              <span className="font-mono text-[11px] text-slate-500">
                IST Timezone
              </span>
            </div>
            <p className="text-slate-700 leading-relaxed">
              {report.detailed_explanation || report.explanation || report.lifecycle_explanation}
            </p>
          </div>

          {/* Key Metric Tables */}
          {reportType.includes('Rollback') && (
            <div className="space-y-1.5">
              <h4 className="font-bold text-slate-900 text-xs">Audit & Checkpoint Integrity Comparison:</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Trusted Witness Sequence:</span>
                  <span className="font-bold text-slate-900 text-sm">{report.checkpoint_sequence}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Observed Sequence:</span>
                  <span className="font-bold text-slate-900 text-sm">{report.current_max_id}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Trusted Entry Count:</span>
                  <span className="font-bold text-slate-900 text-sm">{report.checkpoint_count}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Observed Entry Count:</span>
                  <span className="font-bold text-slate-900 text-sm">{report.current_count}</span>
                </div>
              </div>
            </div>
          )}

          {reportType.includes('Re-Save') && (
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-xs">Dual-Layer File Comparison:</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Original Filename:</span>
                  <span className="font-semibold text-slate-900 truncate block">{report.original_filename}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Submitted Version:</span>
                  <span className="font-semibold text-slate-900 truncate block">{report.new_filename}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Layer 1 (Exact SHA-256):</span>
                  <span className={`font-bold ${report.is_exact_hash_match ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {report.is_exact_hash_match ? 'EXACT MATCH' : 'MISMATCH'}
                  </span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Layer 2 (Content Similarity):</span>
                  <span className="font-bold text-indigo-700">
                    {report.layer2_similarity_pct !== null && report.layer2_similarity_pct !== undefined ? `${report.layer2_similarity_pct.toFixed(2)}%` : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          )}

          {reportType.includes('Signing Key') && (
            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 text-xs">Key Lifecycle & Verification:</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Key ID:</span>
                  <span className="font-mono font-semibold text-slate-900">{report.key_id}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Algorithm:</span>
                  <span className="font-semibold text-slate-900">{report.algorithm}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Key Lifecycle State:</span>
                  <span className="font-bold text-indigo-700">{report.key_status}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <span className="text-slate-500 block">Signature Verification:</span>
                  <span className="font-bold text-slate-900">{report.signature_verification}</span>
                </div>
              </div>
            </div>
          )}

          {/* Security Implications & Recommendations */}
          <div className="p-3.5 rounded-xl border border-indigo-100 bg-indigo-50/40 space-y-2">
            <h4 className="font-bold text-indigo-900 text-xs">Security Implications & Guidance:</h4>
            <p className="text-slate-700 leading-relaxed">
              {report.security_implications}
            </p>
            {report.recommendations && report.recommendations.length > 0 && (
              <ul className="list-disc pl-4 space-y-1 text-slate-700">
                {report.recommendations.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            Report ID: {report.report_id}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-xs transition-colors shadow-2xs"
            >
              Close
            </button>
            <button
              onClick={onDownload}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-xs transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF Report
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
