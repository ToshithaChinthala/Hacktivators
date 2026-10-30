import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Clock, CheckCircle, XCircle, Info, Shield } from 'lucide-react'
import { privypassApi } from '../api/endpoints'
import StatusBadge from '../components/ui/StatusBadge'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import toast from 'react-hot-toast'
import { useWs } from '../context/WsContext'

const credentialTypes = ['age_verification', 'income_verification', 'location_verification', 'membership_verification']
const thresholdLabels = {
  age_verification: 'Minimum Age Required',
  income_verification: 'Minimum Annual Income (USD)',
  location_verification: 'Country Code',
  membership_verification: 'Membership Level',
}

export default function PrivyPassPage() {
  const [form, setForm] = useState({
    credential_type: 'age_verification',
    issuer: 'Demo CA',
    claim_value: '',
    threshold: '',
    user_id: 1,
  })
  const [result, setResult] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [tab, setTab] = useState('verify')
  const { lastMessage } = useWs()

  const fetchHistory = useCallback(async () => {
    try {
      const res = await privypassApi.getHistory()
      setHistory(res.data)
    } catch {}
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])
  useEffect(() => { if (lastMessage?.module === 'privypass') fetchHistory() }, [lastMessage, fetchHistory])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.claim_value || !form.threshold) {
      toast.error('Please fill in all fields')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await privypassApi.verify(form)
      setResult(res.data)
      if (res.data.verification_status === 'ELIGIBLE') toast.success('Credential verified ✓')
      else toast.error('Eligibility check failed')
    } catch {}
    finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      {/* Info banner */}
      <div className="glass rounded-xl p-4 border border-blue-500/20 bg-blue-500/5 flex gap-3">
        <Info className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
        <p className="text-slate-300 text-sm leading-relaxed">
          <span className="font-semibold text-blue-400">Selective-Disclosure Demo:</span> PrivyPass verifies eligibility
          based on your credential data without revealing the raw value in the response.
          This is a server-side demonstration, not a production zero-knowledge proof.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 glass rounded-xl border border-violet-500/15 w-fit">
        {[
          { id: 'verify', label: 'Verify Credential', icon: Key },
          { id: 'history', label: 'History', icon: Clock },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === id ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab === 'verify' && (
          <motion.div
            key="verify"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid lg:grid-cols-2 gap-5"
          >
            {/* Form */}
            <div className="glass rounded-xl p-6 border border-violet-500/15">
              <h3 className="text-white font-semibold mb-5 flex items-center gap-2">
                <Shield className="h-4 w-4 text-blue-400" />
                Credential Submission
              </h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <FormField label="Credential Type">
                  <select
                    value={form.credential_type}
                    onChange={(e) => setForm({ ...form, credential_type: e.target.value })}
                    className="input-base"
                  >
                    {credentialTypes.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Issuing Authority">
                  <input
                    value={form.issuer}
                    onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                    placeholder="e.g. Government ID, Bank"
                    className="input-base"
                  />
                </FormField>

                <FormField label="Your Claim Value (kept private)">
                  <input
                    value={form.claim_value}
                    onChange={(e) => setForm({ ...form, claim_value: e.target.value })}
                    placeholder={form.credential_type === 'age_verification' ? 'e.g. 25' : 'Enter value'}
                    className="input-base"
                    type={form.credential_type.includes('income') ? 'number' : 'text'}
                  />
                </FormField>

                <FormField label={thresholdLabels[form.credential_type] || 'Threshold'}>
                  <input
                    value={form.threshold}
                    onChange={(e) => setForm({ ...form, threshold: e.target.value })}
                    placeholder={form.credential_type === 'age_verification' ? '18' : 'Enter threshold'}
                    className="input-base"
                  />
                </FormField>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 text-white font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {loading ? 'Verifying…' : 'Run Selective Verification'}
                </button>
              </form>
            </div>

            {/* Result */}
            <div className="space-y-4">
              {loading && (
                <div className="glass rounded-xl p-10 border border-violet-500/15 flex items-center justify-center">
                  <LoadingSpinner text="Running verification…" />
                </div>
              )}
              {result && !loading && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`glass rounded-xl p-6 border ${
                    result.verification_status === 'ELIGIBLE'
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-red-500/30 bg-red-500/5'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-4">
                    {result.verification_status === 'ELIGIBLE'
                      ? <CheckCircle className="h-6 w-6 text-emerald-400" />
                      : <XCircle className="h-6 w-6 text-red-400" />}
                    <div>
                      <h4 className={`font-bold ${result.verification_status === 'ELIGIBLE' ? 'text-emerald-400' : 'text-red-400'}`}>
                        {result.verification_status === 'ELIGIBLE' ? 'Eligibility Confirmed' : 'Eligibility Denied'}
                      </h4>
                      <p className="text-slate-400 text-xs">Privacy-preserving result — raw value not disclosed</p>
                    </div>
                  </div>
                  <div className="space-y-2 text-sm">
                    <ResultRow label="Credential Type" value={result.credential_type?.replace(/_/g, ' ')} />
                    <ResultRow label="Issuer" value={result.issuer} />
                    <ResultRow label="Status" value={<StatusBadge status={result.verification_status} />} />
                    <ResultRow label="Message" value={result.message} />
                    <ResultRow label="Receipt ID" value={<span className="font-mono text-xs">{result.receipt_id}</span>} />
                  </div>
                </motion.div>
              )}
              {!result && !loading && (
                <div className="glass rounded-xl p-10 border border-violet-500/15 flex flex-col items-center justify-center gap-3 text-slate-500">
                  <Key className="h-8 w-8 opacity-30" />
                  <p className="text-sm">Submit a credential to see the verification result</p>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {tab === 'history' && (
          <motion.div key="history" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <div className="glass rounded-xl border border-violet-500/15 overflow-hidden">
              <div className="px-5 py-4 border-b border-violet-500/10">
                <h3 className="text-white font-semibold text-sm">Verification History</h3>
              </div>
              {history.length === 0 ? (
                <div className="py-10 text-center text-slate-500 text-sm">No verifications yet.</div>
              ) : (
                <div className="divide-y divide-white/5">
                  {history.map((h) => (
                    <div key={h.id} className="px-5 py-3 flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium">{h.credential_type?.replace(/_/g, ' ')}</p>
                        <p className="text-slate-500 text-xs">{h.issuer} · {new Date(h.created_at).toLocaleString()}</p>
                      </div>
                      <StatusBadge status={h.verification_status} />
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

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-400 mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function ResultRow({ label, value }) {
  return (
    <div className="flex gap-3">
      <span className="text-slate-500 text-xs w-28 flex-shrink-0">{label}:</span>
      <span className="text-slate-200 text-xs">{value}</span>
    </div>
  )
}

