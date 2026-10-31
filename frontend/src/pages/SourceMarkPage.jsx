import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Upload,
  Search,
  File,
  CheckCircle,
  AlertTriangle,
  Clock,
  Fingerprint,
  X,
  ShieldAlert,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
  Layers,
  Check,
} from 'lucide-react'
import { sourcemarkApi } from '../api/endpoints'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { useWs } from '../context/WsContext'

export default function SourceMarkPage() {
  const [tab, setTab] = useState('upload')
  const [files, setFiles] = useState([])
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [verifyResult, setVerifyResult] = useState(null)
  const [selectedBaselineId, setSelectedBaselineId] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const { lastMessage } = useWs()

  const fetchData = useCallback(async () => {
    try {
      const [fRes, hRes] = await Promise.allSettled([
        sourcemarkApi.getFiles(),
        sourcemarkApi.getHistory(),
      ])

      if (fRes.status === 'fulfilled' && Array.isArray(fRes.value.data)) {
        setFiles(fRes.value.data)
      } else if (fRes.status === 'rejected') {
        const msg =
          fRes.reason?.response?.data?.detail ||
          fRes.reason?.message ||
          'Failed to retrieve registered files'
        toast.error(msg, { id: 'sourcemark-get-files-err' })
      }

      if (hRes.status === 'fulfilled' && Array.isArray(hRes.value.data)) {
        setHistory(hRes.value.data)
      }
    } catch (err) {
      toast.error('Error fetching SourceMark records', { id: 'sourcemark-fetch-err' })
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (lastMessage?.module === 'sourcemark') {
      fetchData()
    }
  }, [lastMessage, fetchData])

  const handleUpload = async (file) => {
    if (!file) return

    const MAX = 50 * 1024 * 1024
    if (file.size > MAX) {
      toast.error('File size exceeds 50 MB limit', { id: 'sourcemark-size-err' })
      return
    }

    if (file.size === 0) {
      toast.error('Cannot register an empty file (0 bytes)', { id: 'sourcemark-empty-err' })
      return
    }

    const blockedExtensions = ['.exe', '.bat', '.cmd', '.sh', '.msi', '.dll', '.com', '.scr', '.vbs']
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase()
    if (blockedExtensions.includes(ext)) {
      toast.error(`File type '${ext}' is not permitted for security reasons`, {
        id: 'sourcemark-type-err',
      })
      return
    }

    const fd = new FormData()
    fd.append('file', file)
    setLoading(true)

    try {
      const res = await sourcemarkApi.uploadFile(fd)

      if (res.data?.already_exists) {
        toast.error(
          res.data.message || 'File with this fingerprint is already registered.',
          { id: 'sourcemark-duplicate-warning' }
        )
        await fetchData()
      } else {
        toast.success(res.data?.message || 'File registered successfully', {
          id: 'sourcemark-upload-success',
        })

        if (res.data?.id) {
          setFiles((prev) => {
            const exists = prev.some(
              (f) => f.id === res.data.id || f.original_hash === res.data.original_hash
            )
            if (exists) return prev
            return [res.data, ...prev]
          })
        }
        await fetchData()
      }
      setVerifyResult(null)
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'File registration failed'
      toast.error(msg, { id: 'sourcemark-upload-fail' })
    } finally {
      setLoading(false)
    }
  }

  const handleVerify = async (file) => {
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    if (selectedBaselineId) {
      fd.append('original_file_id', selectedBaselineId)
    }
    setLoading(true)
    try {
      const res = await sourcemarkApi.verifyFile(fd)
      setVerifyResult(res.data)
      if (res.data.verification_status === 'MATCH') {
        toast.success(res.data.verification_message || 'File integrity verified ✓', {
          id: 'sourcemark-verify-match',
        })
      } else if (res.data.original_hash) {
        toast.error('File modification detected! Fingerprint mismatch.', {
          id: 'sourcemark-verify-mismatch',
        })
      } else {
        toast.error('No matching fingerprint or registered file found.', {
          id: 'sourcemark-verify-notfound',
        })
      }
      await fetchData()
    } catch (err) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        err?.message ||
        'Verification failed'
      toast.error(msg, { id: 'sourcemark-verify-err' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white rounded-xl border border-slate-200/80 shadow-2xs w-fit">
        {[
          { id: 'upload', label: 'Register File', icon: Upload },
          { id: 'verify', label: 'Verify File', icon: Search },
          { id: 'history', label: 'History', icon: Clock },
        ].map(({ id, label, icon: Icon }) => (
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
        {/* Upload Tab */}
        {tab === 'upload' && (
          <motion.div
            key="upload"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            <DropZone
              dragOver={dragOver}
              setDragOver={setDragOver}
              onSelectFile={handleUpload}
              loading={loading}
              label="Drop a file to register its SHA-256 fingerprint"
              action="register"
            />

            {/* Registered files */}
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-slate-900 font-semibold text-sm">Registered Files</h3>
                <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 font-medium">
                  {files.length} {files.length === 1 ? 'record' : 'records'}
                </span>
              </div>
              {files.length === 0 ? (
                <EmptyState text="No files registered yet — upload a file above." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {files.map((f) => (
                    <div key={f.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/70 transition-colors">
                      <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center flex-shrink-0">
                        <File className="h-4 w-4 text-indigo-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 text-sm font-medium truncate">{f.filename}</p>
                        <p className="text-slate-500 text-xs font-mono truncate">{f.original_hash}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-slate-700 text-xs font-medium">{((f.file_size || 0) / 1024).toFixed(1)} KB</p>
                        <p className="text-slate-400 text-xs">
                          {f.created_at ? new Date(f.created_at).toLocaleString() : 'Just now'}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* Verify Tab */}
        {tab === 'verify' && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            {/* Optional Baseline Selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
              <div className="flex items-center gap-2">
                <Fingerprint className="h-4 w-4 text-indigo-600 flex-shrink-0" />
                <span className="text-xs font-semibold text-slate-700">Target Baseline (Optional):</span>
              </div>
              <select
                value={selectedBaselineId}
                onChange={(e) => setSelectedBaselineId(e.target.value)}
                className="bg-white border border-slate-300 text-xs text-slate-800 rounded-lg px-3 py-1.5 focus:outline-none focus:border-indigo-500 shadow-2xs max-w-sm"
              >
                <option value="">Auto-detect (matching filename or fingerprint)</option>
                {files.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.filename} ({((f.file_size || 0) / 1024).toFixed(1)} KB)
                  </option>
                ))}
              </select>
            </div>

            <DropZone
              dragOver={dragOver}
              setDragOver={setDragOver}
              onSelectFile={handleVerify}
              loading={loading}
              label="Drop a file to verify its integrity against registered fingerprints"
              action="verify"
            />
            {verifyResult && <VerifyResult result={verifyResult} onClose={() => setVerifyResult(null)} />}
          </motion.div>
        )}

        {/* History Tab */}
        {tab === 'history' && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-slate-900 font-semibold text-sm">Verification History</h3>
                <span className="text-xs text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200 font-medium">
                  {history.length} {history.length === 1 ? 'event' : 'events'}
                </span>
              </div>
              {history.length === 0 ? (
                <EmptyState text="No verifications yet." />
              ) : (
                <div className="divide-y divide-slate-100">
                  {history.map((h) => (
                    <div key={h.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-slate-50/70 transition-colors">
                      <StatusIcon status={h.verification_status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-slate-900 text-sm font-medium truncate">{h.filename}</p>
                        <p className="text-slate-500 text-xs font-mono truncate">{h.submitted_hash}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <StatusBadge status={h.verification_status} />
                        <span className="text-slate-400 text-xs">{new Date(h.verified_at).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function DropZone({ dragOver, setDragOver, onSelectFile, loading, label, action }) {
  const fileInputRef = useRef(null)

  const handleInputChange = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) {
      onSelectFile(file)
    }
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        const file = e.dataTransfer.files?.[0]
        if (file) {
          onSelectFile(file)
        }
      }}
      onClick={() => {
        if (!loading && fileInputRef.current) {
          fileInputRef.current.click()
        }
      }}
      className={`flex flex-col items-center justify-center gap-4 p-10 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
        dragOver
          ? 'border-indigo-600 bg-indigo-50/40'
          : 'border-slate-300 bg-white hover:border-indigo-400 hover:bg-slate-50/50 shadow-xs'
      }`}
    >
      {loading ? (
        <LoadingSpinner size="lg" text={action === 'register' ? 'Registering…' : 'Verifying…'} />
      ) : (
        <>
          <div className="h-14 w-14 rounded-full bg-indigo-50 border border-indigo-100 flex items-center justify-center">
            <Fingerprint className="h-7 w-7 text-indigo-600" />
          </div>
          <div className="text-center">
            <p className="text-slate-800 font-semibold text-sm mb-1">{label}</p>
            <p className="text-slate-500 text-xs">Click to browse or drag & drop · max 50 MB</p>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (!loading && fileInputRef.current) {
                fileInputRef.current.click()
              }
            }}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 transition-colors shadow-xs"
          >
            {action === 'register' ? 'Select File to Register' : 'Select File to Verify'}
          </button>
        </>
      )}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        onChange={handleInputChange}
        disabled={loading}
      />
    </div>
  )
}

function VerifyResult({ result, onClose }) {
  const [downloading, setDownloading] = useState(false)
  const isMatch = result.verification_status === 'MATCH'
  const hasRegistered = Boolean(result.original_hash)
  const comp = result.comparison

  const changePct = comp ? comp.change_percentage : (isMatch ? 0 : 100)
  const simPct = comp ? comp.similarity_percentage : (isMatch ? 100 : 0)

  const handleDownload = async () => {
    if (!comp?.comparison_id) return
    try {
      setDownloading(true)
      const res = await sourcemarkApi.downloadReport(comp.comparison_id)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `SourceMark_Report_${comp.comparison_id}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Integrity report downloaded', { id: 'pdf-dl-ok' })
    } catch (err) {
      toast.error('Failed to download report PDF', { id: 'pdf-dl-err' })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`rounded-xl p-5 border space-y-4 shadow-sm ${
        isMatch
          ? 'border-emerald-200 bg-emerald-50/50'
          : hasRegistered
          ? 'border-rose-200 bg-rose-50/50'
          : 'border-amber-200 bg-amber-50/50'
      }`}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
        <div className="flex items-center gap-2.5">
          {isMatch ? (
            <div className="h-8 w-8 rounded-lg bg-emerald-100 border border-emerald-200 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
          ) : hasRegistered ? (
            <div className="h-8 w-8 rounded-lg bg-rose-100 border border-rose-200 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="h-5 w-5 text-rose-600" />
            </div>
          ) : (
            <div className="h-8 w-8 rounded-lg bg-amber-100 border border-amber-200 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="h-5 w-5 text-amber-600" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h4 className={`font-semibold text-sm ${isMatch ? 'text-emerald-800' : hasRegistered ? 'text-rose-800' : 'text-amber-800'}`}>
                {isMatch
                  ? 'Integrity Verified (MATCH)'
                  : hasRegistered
                  ? 'Modification Detected (MISMATCH)'
                  : 'Unregistered Fingerprint'}
              </h4>
              <span
                className={`text-[11px] font-mono px-2 py-0.5 rounded-full border ${
                  isMatch
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : 'bg-rose-100 text-rose-800 border-rose-200'
                }`}
              >
                {isMatch ? '0.0% Difference' : `${changePct.toFixed(2)}% Difference`}
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-0.5">
              {comp?.comparison_method || (isMatch ? 'Exact SHA-256 Match' : 'Cryptographic Comparison')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center">
          {comp?.comparison_id && (
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition-all shadow-xs"
            >
              <Download className="h-3.5 w-3.5" />
              {downloading ? 'Downloading...' : 'PDF Report'}
            </button>
          )}
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Similarity & Change Progress Bar */}
      {comp && (
        <div className="space-y-1.5 bg-white p-3.5 rounded-lg border border-slate-200/80 shadow-2xs">
          <div className="flex justify-between text-xs">
            <span className="text-slate-700 font-medium flex items-center gap-1.5">
              Similarity Score:
              <strong className={isMatch ? 'text-emerald-600 font-bold' : simPct >= 70 ? 'text-amber-600 font-bold' : 'text-rose-600 font-bold'}>
                {simPct.toFixed(2)}%
              </strong>
            </span>
            <span className="text-slate-500 text-[11px]">
              Variance: <span className="font-mono text-slate-800 font-medium">{changePct.toFixed(2)}%</span>
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
            <div
              className={`h-full transition-all duration-500 ${
                isMatch
                  ? 'bg-emerald-500'
                  : simPct >= 70
                  ? 'bg-amber-500'
                  : 'bg-rose-500'
              }`}
              style={{ width: `${Math.max(2, Math.min(100, simPct))}%` }}
            />
          </div>
        </div>
      )}

      {/* Executive Summary */}
      <div className="p-3 bg-white rounded-lg border border-slate-200/80 shadow-2xs">
        <p className="text-slate-700 text-xs leading-relaxed">
          {comp?.summary || result.verification_message}
        </p>
      </div>

      {/* Badges / Metrics Row */}
      {comp && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-md bg-white text-slate-700 border border-slate-200 font-mono shadow-2xs">
            Format: {comp.file_type?.toUpperCase()}
          </span>
          {comp.affected_pages && comp.affected_pages.length > 0 && (
            <span className="px-2.5 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 font-mono">
              Affected: {comp.affected_pages.join(', ')}
            </span>
          )}
          {comp.comparison_id && (
            <span className="px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 font-mono">
              ID: {comp.comparison_id}
            </span>
          )}
        </div>
      )}

      {/* Detected Modifications / Diff Details */}
      {comp && !isMatch && (
        <div className="space-y-3 pt-2">
          {/* Added items */}
          {comp.added && comp.added.length > 0 && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <span>+ Added Content / Entries ({comp.added.length})</span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {comp.added.map((item, idx) => (
                  <div key={idx} className="text-xs text-emerald-900 font-mono bg-white px-2.5 py-1.5 rounded border border-emerald-200 break-all shadow-2xs">
                    + {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Removed items */}
          {comp.removed && comp.removed.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50/60 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-800">
                <span>- Removed Content / Entries ({comp.removed.length})</span>
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {comp.removed.map((item, idx) => (
                  <div key={idx} className="text-xs text-rose-900 font-mono bg-white px-2.5 py-1.5 rounded border border-rose-200 break-all shadow-2xs">
                    - {item}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Modified sections */}
          {comp.modified && comp.modified.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-800">
                <span>~ Modified Sections ({comp.modified.length})</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {comp.modified.map((mod, idx) => (
                  <div key={idx} className="p-2.5 rounded bg-white border border-amber-200 space-y-1 text-xs shadow-2xs">
                    <span className="text-[11px] font-mono font-semibold text-amber-800">
                      [{mod.section || `Section ${idx + 1}`}]
                    </span>
                    {mod.original && (
                      <div className="text-rose-700 font-mono bg-rose-50 p-1.5 rounded border border-rose-200 break-words line-through">
                        {mod.original}
                      </div>
                    )}
                    {mod.modified && (
                      <div className="text-emerald-700 font-mono bg-emerald-50 p-1.5 rounded border border-emerald-200 break-words">
                        {mod.modified}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Image Matrix Previews */}
          {comp.structural_details?.diff_preview_base64 && (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3.5 space-y-2">
              <span className="text-xs font-semibold text-indigo-900">Visual Differential Matrix</span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {comp.structural_details?.orig_thumbnail_base64 && (
                  <div className="space-y-1 text-center bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-medium">Registered Original</span>
                    <img
                      src={`data:image/png;base64,${comp.structural_details.orig_thumbnail_base64}`}
                      alt="Original"
                      className="rounded border border-slate-200 mx-auto max-h-32 object-contain"
                    />
                  </div>
                )}
                {comp.structural_details?.up_thumbnail_base64 && (
                  <div className="space-y-1 text-center bg-white p-2 rounded-lg border border-slate-200 shadow-2xs">
                    <span className="text-[10px] text-slate-500 font-medium">Submitted Upload</span>
                    <img
                      src={`data:image/png;base64,${comp.structural_details.up_thumbnail_base64}`}
                      alt="Submitted"
                      className="rounded border border-slate-200 mx-auto max-h-32 object-contain"
                    />
                  </div>
                )}
                <div className="space-y-1 text-center bg-white p-2 rounded-lg border border-indigo-200 shadow-2xs">
                  <span className="text-[10px] text-indigo-700 font-semibold">Difference Mask</span>
                  <img
                    src={`data:image/png;base64,${comp.structural_details.diff_preview_base64}`}
                    alt="Difference"
                    className="rounded border border-indigo-200 mx-auto max-h-32 object-contain"
                  />
                </div>
              </div>
              {comp.structural_details?.bounding_box && (
                <p className="text-[11px] text-slate-600 font-mono text-center">
                  Bounding Box: [x: {comp.structural_details.bounding_box.x}, y: {comp.structural_details.bounding_box.y}, w: {comp.structural_details.bounding_box.w}, h: {comp.structural_details.bounding_box.h}] · Changed Pixels: {comp.structural_details.changed_pixels?.toLocaleString()}
                </p>
              )}
            </div>
          )}

          {/* Generic Binary Heuristic Notice */}
          {comp.structural_details?.heuristic && (
            <p className="text-[11px] text-slate-500 italic">
              Note: Generic binary byte-divergence comparison applied. Offset of first difference: {comp.structural_details?.first_difference_offset ?? 'N/A'}.
            </p>
          )}
        </div>
      )}

      {/* Cryptographic Hashes Comparison */}
      <div className="space-y-1.5 pt-2 border-t border-slate-200/60">
        <HashRow label="Submitted Hash" value={result.submitted_hash} />
        {result.original_hash ? (
          <HashRow label="Registered Hash" value={result.original_hash} />
        ) : (
          <HashRow label="Registered Hash" value="None (Unregistered baseline)" />
        )}
      </div>

      {/* Bottom CTA for PDF Download */}
      {comp?.comparison_id && (
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-all shadow-xs"
          >
            <Download className="h-4 w-4" />
            {downloading ? 'Preparing Report...' : 'Download Full Integrity Audit Report (PDF)'}
          </button>
        </div>
      )}
    </motion.div>
  )
}

function HashRow({ label, value }) {
  return (
    <div className="flex gap-2 text-xs">
      <span className="text-slate-500 w-32 flex-shrink-0 font-medium">{label}:</span>
      <span className="text-slate-800 font-mono break-all font-medium">{value}</span>
    </div>
  )
}

function StatusIcon({ status }) {
  return status === 'MATCH' ? (
    <div className="h-7 w-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
      <CheckCircle className="h-4 w-4 text-emerald-600" />
    </div>
  ) : (
    <div className="h-7 w-7 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center flex-shrink-0">
      <AlertTriangle className="h-4 w-4 text-rose-600" />
    </div>
  )
}

function EmptyState({ text }) {
  return <div className="py-10 text-center text-slate-400 text-sm">{text}</div>
}
