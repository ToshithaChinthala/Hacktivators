import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Lock, Clock, Upload, CheckCircle, AlertTriangle, Link as LinkIcon,
  ShieldCheck, UserCheck, Shield
} from 'lucide-react'
import { evidencelockApi } from '../api/endpoints'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { useWs } from '../context/WsContext'
import { useAuth } from '../context/AuthContext'
import { formatIST } from '../utils/date'

export default function EvidenceLockPage() {
  const [tab, setTab] = useState('register')
  const [records, setRecords] = useState([])
  const [history, setHistory] = useState([])
  const [chainResult, setChainResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [form, setForm] = useState({ evidence_name: '', evidence_type: 'document' })
  const [file, setFile] = useState(null)
  const { lastMessage } = useWs()
  const { user } = useAuth()

  const fetchData = useCallback(async () => {
    try {
      const [rRes, hRes] = await Promise.all([
        evidencelockApi.getRecords(),
        evidencelockApi.getHistory(),
      ])
      setRecords(rRes.data || [])
      setHistory(hRes.data || [])
    } catch (err) {
      console.error('Failed to fetch evidence data:', err)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    if (lastMessage?.module === 'evidencelock') {
      fetchData()
    }
  }, [lastMessage, fetchData])

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!file || !form.evidence_name) {
      toast.error('Please enter evidence name and select a file')
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('evidence_name', form.evidence_name)
    fd.append('evidence_type', form.evidence_type)
    setLoading(true)
    try {
      await evidencelockApi.register(fd)
      toast.success('Evidence registered in your actor flow & audit entry created')
      setFile(null)
      setForm({ evidence_name: '', evidence_type: 'document' })
      fetchData()
      setTab('records')
    } catch (err) {
      const detail = err.response?.data?.detail || 'Registration failed'
      toast.error(detail)
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyChain = async () => {
    setVerifyLoading(true)
    setChainResult(null)
    try {
      const res = await evidencelockApi.verifyChain()
      setChainResult(res.data)
      if (res.data.chain_valid) {
        toast.success('Audit chain integrity verified ✓')
      } else {
        toast.error('Chain integrity violation detected!')
      }
    } catch (err) {
      toast.error('Failed to verify chain integrity')
    } finally {
      setVerifyLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Actor Flow Header Banner */}
      <div className="glass rounded-xl p-5 border border-violet-500/20 bg-gradient-to-r from-violet-950/30 to-indigo-950/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
            <Lock className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-white font-bold text-base">EvidenceLock</h2>
              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30">
                Actor Isolation
              </span>
            </div>
            <p className="text-slate-400 text-xs">
              Cryptographically secured evidence management with user-isolated audit flows
            </p>
          </div>
        </div>

        {/* Current Actor Pill */}
        <div className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-white/5 border border-white/10 text-xs">
          <UserCheck className="h-4 w-4 text-emerald-400 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-slate-400 text-[11px] font-medium leading-none mb-0.5">Active Actor Flow</div>
            <div className="text-white font-semibold truncate flex items-center gap-2">
              <span>{user?.email || 'Authenticated User'}</span>
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                user?.role === 'admin'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {user?.role || 'user'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 glass rounded-xl border border-violet-500/15 w-fit">
        {[
          { id: 'register', label: 'Register Evidence', icon: Upload },
          { id: 'records', label: `My Evidence (${records.length})`, icon: Lock },
          { id: 'audit', label: `My Audit Flow (${history.length})`, icon: LinkIcon },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? 'bg-violet-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'register' && (
          <motion.div
            key="register"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="grid lg:grid-cols-2 gap-5"
          >
            <div className="glass rounded-xl p-6 border border-violet-500/15 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-emerald-400" />
                Register Evidence in Your Flow
              </h3>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Evidence Name</label>
                  <input
                    value={form.evidence_name}
                    onChange={(e) => setForm({ ...form, evidence_name: e.target.value })}
                    placeholder="e.g. Contract_2024_Q1"
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Evidence Type</label>
                  <select
                    value={form.evidence_type}
                    onChange={(e) => setForm({ ...form, evidence_type: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors"
                  >
                    {['document', 'image', 'video', 'audio', 'data', 'other'].map((t) => (
                      <option key={t} value={t} className="bg-slate-900 text-white">
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Owner / Authenticated Actor</label>
                  <div className="w-full bg-white/5 border border-white/5 rounded-lg px-4 py-2.5 text-slate-300 text-sm flex items-center justify-between">
                    <span className="font-mono text-xs">{user?.email || 'Authenticated User'}</span>
                    <span className="text-[11px] text-violet-400 font-medium">Session-Derived</span>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Evidence File</label>
                  <label
                    className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                      file
                        ? 'border-emerald-500/50 bg-emerald-500/5'
                        : 'border-white/10 hover:border-violet-500/40'
                    }`}
                  >
                    {file ? (
                      <span className="text-emerald-400 text-sm font-medium">{file.name}</span>
                    ) : (
                      <span className="text-slate-500 text-sm">Click to select file</span>
                    )}
                    <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                  </label>
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50 shadow-lg shadow-emerald-600/20"
                >
                  {loading ? 'Registering…' : 'Register & Create Tamper-Evident Entry'}
                </button>
              </form>
            </div>

            <div className="glass rounded-xl p-6 border border-violet-500/15">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                Actor Isolation & Security Guarantees
              </h3>
              <ol className="space-y-3.5">
                {[
                  {
                    title: 'Authenticated Session Binding',
                    desc: 'Every evidence registration strictly binds to your authenticated account ID. Client-supplied actor strings are ignored.',
                  },
                  {
                    title: 'Authoritative SHA-256 Hashing',
                    desc: 'File contents are hashed server-side using SHA-256, guaranteeing cryptographic exact-byte integrity.',
                  },
                  {
                    title: 'Tamper-Evident Hash Chain',
                    desc: 'Each audit event incorporates the SHA-256 hash of the previous ledger event, making post-hoc tampering computationally impossible.',
                  },
                  {
                    title: 'Strict User Privacy & Flow Separation',
                    desc: 'Your evidence records are completely invisible to other users. Attempting to access another user’s record ID returns HTTP 404.',
                  },
                  {
                    title: 'Indian Standard Time (IST)',
                    desc: 'All audit events and registration timestamps are reported in Asia/Kolkata (UTC+05:30) for localized compliance.',
                  },
                ].map((item, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span className="text-emerald-400 font-bold flex-shrink-0">{i + 1}.</span>
                    <div>
                      <p className="text-slate-200 font-medium text-xs">{item.title}</p>
                      <p className="text-slate-400 text-xs mt-0.5">{item.desc}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        )}

        {tab === 'records' && (
          <motion.div
            key="records"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <div className="glass rounded-xl border border-violet-500/15 overflow-hidden">
              <div className="px-5 py-4 border-b border-violet-500/10 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold text-sm">My Evidence Records</h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Records owned by {user?.email || 'you'} (Actor Flow)
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono">
                  {records.length} item{records.length === 1 ? '' : 's'}
                </span>
              </div>
              {records.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No evidence registered in your flow yet. Use &ldquo;Register Evidence&rdquo; to add your first record.
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {records.map((r) => (
                    <div key={r.id} className="px-5 py-3.5 flex items-start gap-4 hover:bg-white/[0.02] transition-colors">
                      <Lock className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-semibold">{r.evidence_name}</p>
                          <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-300 border border-white/10">
                            {r.evidence_type}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs font-mono truncate mt-1" title={r.evidence_hash}>
                          <span className="text-slate-500">SHA-256: </span>{r.evidence_hash}
                        </p>
                        <p className="text-slate-500 text-xs mt-1">
                          Owner: <span className="text-slate-300">{r.uploaded_by}</span>
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <StatusBadge status="REGISTERED" />
                        <p className="text-slate-400 text-xs mt-1 flex items-center gap-1 justify-end font-mono">
                          <Clock className="h-3 w-3 text-slate-500" />
                          {formatIST(r.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {tab === 'audit' && (
          <motion.div
            key="audit"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* Global Chain Verification Header */}
            <div className="glass rounded-xl p-4 border border-violet-500/15 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <h4 className="text-white font-semibold text-sm">Global Ledger Verification</h4>
                <p className="text-slate-400 text-xs mt-0.5">
                  Verify cryptographic continuity across the entire ledger while viewing your actor-filtered events.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleVerifyChain}
                  disabled={verifyLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity shadow-lg shadow-emerald-600/20"
                >
                  {verifyLoading ? 'Verifying…' : (
                    <>
                      <ShieldCheck className="h-4 w-4" />
                      Verify Chain Integrity
                    </>
                  )}
                </button>
                {chainResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                      chainResult.chain_valid
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}
                  >
                    {chainResult.chain_valid ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    <span>{chainResult.message} ({chainResult.total_events} events)</span>
                  </motion.div>
                )}
              </div>
            </div>

            {/* User's Audit Log Chain */}
            <div className="glass rounded-xl border border-violet-500/15 overflow-hidden">
              <div className="px-5 py-4 border-b border-violet-500/10 flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold text-sm">My Audit Flow</h3>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Chronological audit events associated with your actor account ({user?.email})
                  </p>
                </div>
                <span className="text-xs px-2.5 py-1 rounded-full bg-violet-500/10 text-violet-300 border border-violet-500/20 font-mono">
                  {history.length} event{history.length === 1 ? '' : 's'}
                </span>
              </div>
              {history.length === 0 ? (
                <div className="py-12 text-center text-slate-500 text-sm">
                  No audit events recorded for your account yet.
                </div>
              ) : (
                <div className="p-5 space-y-3">
                  {history.map((h, idx) => (
                    <div key={h.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-violet-500 flex-shrink-0 mt-1" />
                        {idx < history.length - 1 && <div className="w-0.5 flex-1 bg-violet-500/20 mt-1" />}
                      </div>
                      <div className="pb-4 min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-white text-xs font-semibold bg-violet-500/20 px-2 py-0.5 rounded text-violet-300 border border-violet-500/30">
                            {h.action}
                          </span>
                          <span className="text-slate-400 text-xs font-mono flex items-center gap-1">
                            <Clock className="h-3 w-3 text-slate-500" />
                            {formatIST(h.timestamp)}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs mb-1.5">
                          Target: <span className="text-slate-200 font-mono">{h.entity_type} #{h.entity_id}</span> · Actor: <span className="text-emerald-400 font-medium">{h.actor}</span>
                        </p>
                        <div className="space-y-1 bg-black/20 p-2.5 rounded-lg border border-white/5 font-mono text-[11px]">
                          <p className="text-slate-500 truncate" title={h.previous_hash || 'GENESIS'}>
                            <span className="text-slate-600">prev: </span>{h.previous_hash || 'GENESIS'}
                          </p>
                          <p className="text-violet-400 truncate" title={h.current_hash}>
                            <span className="text-violet-600">curr: </span>{h.current_hash}
                          </p>
                        </div>
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
