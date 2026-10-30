import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Search, File, CheckCircle, AlertTriangle, Clock, Fingerprint, X, ShieldAlert } from 'lucide-react'
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
    fd.append('user_id', 1)
    setLoading(true)

    try {
      const res = await sourcemarkApi.uploadFile(fd)

      if (res.data?.already_exists) {
        toast.error(
          res.data.message || 'File with this fingerprint is already registered.',
          { id: 'sourcemark-duplicate-warning' }
        )
        // Refresh to ensure list reflects database state
        await fetchData()
      } else {
        toast.success(res.data?.message || 'File registered successfully', {
          id: 'sourcemark-upload-success',
        })

        // Immediate state update to guarantee responsiveness
        if (res.data?.id) {
          setFiles((prev) => {
            const exists = prev.some(
              (f) => f.id === res.data.id || f.original_hash === res.data.original_hash
            )
            if (exists) return prev
            return [res.data, ...prev]
          })
        }

        // Fresh synchronization from MySQL
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
      <div className="flex gap-1 p-1 glass rounded-xl border border-violet-500/15 w-fit">
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
                ? 'bg-violet-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
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
            <div className="glass rounded-xl border border-violet-500/15 overflow-hidden">
              <div className="px-5 py-4 border-b border-violet-500/10 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Registered Files</h3>
                <span className="text-xs text-slate-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                  {files.length} {files.length === 1 ? 'record' : 'records'}
                </span>
              </div>
              {files.length === 0 ? (
                <EmptyState text="No files registered yet — upload a file above." />
              ) : (
                <div className="divide-y divide-white/5">
                  {files.map((f) => (
                    <div key={f.id} className="px-5 py-3 flex items-center gap-4 hover:bg-white/2 transition-colors">
                      <File className="h-4 w-4 text-violet-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{f.filename}</p>
                        <p className="text-slate-500 text-xs font-mono truncate">{f.original_hash}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-slate-400 text-xs">{((f.file_size || 0) / 1024).toFixed(1)} KB</p>
                        <p className="text-slate-500 text-xs">
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
            <div className="glass rounded-xl border border-violet-500/15 overflow-hidden">
              <div className="px-5 py-4 border-b border-violet-500/10 flex items-center justify-between">
                <h3 className="text-white font-semibold text-sm">Verification History</h3>
                <span className="text-xs text-slate-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/10">
                  {history.length} {history.length === 1 ? 'event' : 'events'}
                </span>
              </div>
              {history.length === 0 ? (
                <EmptyState text="No verifications yet." />
              ) : (
                <div className="divide-y divide-white/5">
                  {history.map((h) => (
                    <div key={h.id} className="px-5 py-3 flex items-center gap-4">
                      <StatusIcon status={h.verification_status} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{h.filename}</p>
                        <p className="text-slate-500 text-xs font-mono truncate">{h.submitted_hash}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <StatusBadge status={h.verification_status} />
                        <span className="text-slate-500 text-xs">{new Date(h.verified_at).toLocaleString()}</span>
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
          ? 'border-violet-500 bg-violet-500/10'
          : 'border-violet-500/25 glass hover:border-violet-500/50 hover:bg-white/2'
      }`}
    >
      {loading ? (
        <LoadingSpinner size="lg" text={action === 'register' ? 'Registering…' : 'Verifying…'} />
      ) : (
        <>
          <div className="h-14 w-14 rounded-full bg-violet-600/15 border border-violet-500/30 flex items-center justify-center">
            <Fingerprint className="h-7 w-7 text-violet-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-medium text-sm mb-1">{label}</p>
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
            className="px-4 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 transition-colors"
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
  const isMatch = result.verification_status === 'MATCH'
  const hasRegistered = Boolean(result.original_hash)
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`glass rounded-xl p-5 border ${
        isMatch ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-red-500/30 bg-red-500/5'
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isMatch
            ? <CheckCircle className="h-5 w-5 text-emerald-400" />
            : <AlertTriangle className="h-5 w-5 text-red-400" />}
          <h4 className={`font-semibold text-sm ${isMatch ? 'text-emerald-400' : 'text-red-400'}`}>
            {isMatch
              ? 'Integrity Verified (MATCH)'
              : hasRegistered
              ? 'Modification Detected (HASH MISMATCH)'
              : 'No Matching Fingerprint'}
          </h4>
        </div>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X className="h-4 w-4" /></button>
      </div>
      <p className="text-slate-300 text-sm mb-3">{result.verification_message}</p>
      <div className="space-y-1.5">
        <HashRow label="Submitted Hash" value={result.submitted_hash} />
        {result.original_hash ? (
          <HashRow label="Registered Hash" value={result.original_hash} />
        ) : (
          <HashRow label="Registered Hash" value="None (Unregistered or unlinked file)" />
        )}
      </div>
    </motion.div>
  )
}

function HashRow({ label, value }) {
  return (
    <div className="flex gap-2">
      <span className="text-slate-500 text-xs w-32 flex-shrink-0">{label}:</span>
      <span className="text-slate-300 text-xs font-mono break-all">{value}</span>
    </div>
  )
}

function StatusIcon({ status }) {
  return status === 'MATCH'
    ? <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
    : <AlertTriangle className="h-4 w-4 text-red-400 flex-shrink-0" />
}

function EmptyState({ text }) {
  return (
    <div className="py-10 text-center text-slate-500 text-sm">{text}</div>
  )
}
