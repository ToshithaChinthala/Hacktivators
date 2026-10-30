import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Clock, Upload, CheckCircle, AlertTriangle, Link as LinkIcon, ShieldCheck } from 'lucide-react'
import { evidencelockApi } from '../api/endpoints'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { useWs } from '../context/WsContext'

export default function EvidenceLockPage() {
  const [tab, setTab] = useState('register')
  const [records, setRecords] = useState([])
  const [history, setHistory] = useState([])
  const [chainResult, setChainResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [form, setForm] = useState({ evidence_name: '', evidence_type: 'document', uploaded_by: 'admin' })
  const [file, setFile] = useState(null)
  const { lastMessage } = useWs()

  const fetchData = useCallback(async () => {
    try {
      const [rRes, hRes] = await Promise.all([
        evidencelockApi.getRecords(),
        evidencelockApi.getHistory(),
      ])
      setRecords(rRes.data)
      setHistory(hRes.data)
    } catch {}
  }, [])

  useEffect(() => { fetchData() }, [fetchData])
  useEffect(() => { if (lastMessage?.module === 'evidencelock') fetchData() }, [lastMessage, fetchData])

  const handleRegister = async (e) => {
    e.preventDefault()
    if (!file || !form.evidence_name) { toast.error('Please fill in all fields and select a file'); return }
    const fd = new FormData()
    fd.append('file', file)
    fd.append('evidence_name', form.evidence_name)
    fd.append('evidence_type', form.evidence_type)
    fd.append('uploaded_by', form.uploaded_by)
    setLoading(true)
    try {
      await evidencelockApi.register(fd)
      toast.success('Evidence registered and audit event created')
      setFile(null)
      setForm({ evidence_name: '', evidence_type: 'document', uploaded_by: 'admin' })
      fetchData()
    } catch {}
    finally { setLoading(false) }
  }

  const handleVerifyChain = async () => {
    setVerifyLoading(true)
    setChainResult(null)
    try {
      const res = await evidencelockApi.verifyChain()
      setChainResult(res.data)
      if (res.data.chain_valid) toast.success('Audit chain integrity verified ✓')
      else toast.error('Chain integrity violation detected!')
    } catch {}
    finally { setVerifyLoading(false) }
  }

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 p-1 glass rounded-xl border border-violet-500/15 w-fit">
        {[
          { id: 'register', label: 'Register Evidence', icon: Upload },
          { id: 'records', label: 'Records', icon: Lock },
          { id: 'audit', label: 'Audit Chain', icon: LinkIcon },
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'register' && (
          <motion.div key="register" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="grid lg:grid-cols-2 gap-5">
            <div className="glass rounded-xl p-6 border border-violet-500/15 space-y-4">
              <h3 className="text-white font-semibold flex items-center gap-2">
                <Lock className="h-4 w-4 text-emerald-400" />
                Register Evidence
              </h3>
              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Evidence Name</label>
                  <input value={form.evidence_name} onChange={(e) => setForm({ ...form, evidence_name: e.target.value })} placeholder="e.g. Contract_2024_Q1" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Evidence Type</label>
                  <select value={form.evidence_type} onChange={(e) => setForm({ ...form, evidence_type: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors">
                    {['document', 'image', 'video', 'audio', 'data', 'other'].map((t) => (
                      <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Uploaded By</label>
                  <input value={form.uploaded_by} onChange={(e) => setForm({ ...form, uploaded_by: e.target.value })} placeholder="Your name or role" className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-violet-500/50 transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1.5">Evidence File</label>
                  <label className={`flex items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${file ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/10 hover:border-violet-500/40'}`}>
                    {file ? (
                      <span className="text-emerald-400 text-sm">{file.name}</span>
                    ) : (
                      <span className="text-slate-500 text-sm">Click to select file</span>
                    )}
                    <input type="file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
                  </label>
                </div>
                <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50">
                  {loading ? 'Registering…' : 'Register & Create Audit Entry'}
                </button>
              </form>
            </div>
            <div className="glass rounded-xl p-6 border border-violet-500/15">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                How It Works
              </h3>
              <ol className="space-y-3">
                {[
                  'Upload any file — its SHA-256 hash is computed server-side.',
                  'Evidence metadata and hash are stored in MySQL.',
                  'An audit log entry is created with the previous entry\'s hash linked in.',
                  'Each entry forms a hash chain — modifying any record breaks the chain.',
                  'Use "Verify Chain" to check the full audit chain integrity at any time.',
                ].map((s, i) => (
                  <li key={i} className="flex gap-3 text-sm text-slate-400">
                    <span className="text-emerald-400 font-bold flex-shrink-0">{i + 1}.</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </motion.div>
        )}

        {tab === 'records' && (
          <motion.div key="records" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="glass rounded-xl border border-violet-500/15 overflow-hidden">
              <div className="px-5 py-4 border-b border-violet-500/10">
                <h3 className="text-white font-semibold text-sm">Evidence Records</h3>
              </div>
              {records.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-sm">No evidence registered yet.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {records.map((r) => (
                    <div key={r.id} className="px-5 py-3 flex items-start gap-4">
                      <Lock className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{r.evidence_name}</p>
                        <p className="text-slate-500 text-xs font-mono truncate">{r.evidence_hash}</p>
                        <p className="text-slate-500 text-xs">{r.evidence_type} · by {r.uploaded_by}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <StatusBadge status="REGISTERED" />
                        <p className="text-slate-500 text-xs mt-1">{new Date(r.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {tab === 'audit' && (
          <motion.div key="audit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
            <div className="flex items-center gap-3">
              <button onClick={handleVerifyChain} disabled={verifyLoading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
                {verifyLoading ? 'Verifying…' : <><ShieldCheck className="h-4 w-4" /> Verify Chain Integrity</>}
              </button>
              {chainResult && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium ${chainResult.chain_valid ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-red-500/10 border-red-500/30 text-red-400'}`}>
                  {chainResult.chain_valid ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                  {chainResult.message}
                </motion.div>
              )}
            </div>

            <div className="glass rounded-xl border border-violet-500/15 overflow-hidden">
              <div className="px-5 py-4 border-b border-violet-500/10">
                <h3 className="text-white font-semibold text-sm">Audit Log Chain</h3>
              </div>
              {history.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-sm">No audit events yet.</div>
              ) : (
                <div className="p-5 space-y-2">
                  {history.map((h, idx) => (
                    <div key={h.id} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className="h-3 w-3 rounded-full bg-violet-500 flex-shrink-0 mt-1" />
                        {idx < history.length - 1 && <div className="w-0.5 flex-1 bg-violet-500/20 mt-1" />}
                      </div>
                      <div className="pb-4 min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white text-xs font-semibold">{h.action}</span>
                          <span className="text-slate-500 text-xs">{new Date(h.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-slate-400 text-xs mb-1">{h.entity_type} · Actor: {h.actor}</p>
                        <div className="space-y-0.5">
                          <p className="text-xs font-mono text-slate-500 truncate">prev: {h.previous_hash || 'GENESIS'}</p>
                          <p className="text-xs font-mono text-violet-400 truncate">curr: {h.current_hash}</p>
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

