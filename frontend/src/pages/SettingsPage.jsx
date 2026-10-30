import { useState } from 'react'
import { Settings, Database, Key, Bell, Shield, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import { healthApi } from '../api/endpoints'

export default function SettingsPage() {
  const [apiUrl, setApiUrl] = useState(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000')
  const [checking, setChecking] = useState(false)
  const [health, setHealth] = useState(null)

  const checkHealth = async () => {
    setChecking(true)
    setHealth(null)
    try {
      const res = await healthApi.check()
      setHealth(res.data)
      toast.success('Backend is healthy ✓')
    } catch {
      toast.error('Backend unreachable')
    } finally { setChecking(false) }
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* API Config */}
      <Section icon={Database} title="Backend Configuration">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-400 mb-1.5">API Base URL</label>
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm focus:outline-none focus:border-violet-500/50 transition-colors font-mono"
            />
            <p className="text-slate-500 text-xs mt-1">Set VITE_API_BASE_URL in frontend/.env to change permanently</p>
          </div>
          <div className="flex gap-3">
            <button onClick={checkHealth} disabled={checking} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
              {checking ? 'Checking…' : 'Check API Health'}
            </button>
            <a href={`${apiUrl}/docs`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg glass border border-white/10 text-slate-300 text-sm hover:text-white transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />Swagger Docs
            </a>
            <a href="http://localhost:5555" target="_blank" rel="noreferrer" className="flex items-center gap-2 px-4 py-2 rounded-lg glass border border-white/10 text-slate-300 text-sm hover:text-white transition-colors">
              <ExternalLink className="h-3.5 w-3.5" />Prisma Studio
            </a>
          </div>
          {health && (
            <pre className="glass rounded-lg p-4 text-xs text-slate-300 font-mono border border-violet-500/15 overflow-auto">
              {JSON.stringify(health, null, 2)}
            </pre>
          )}
        </div>
      </Section>

      {/* Environment vars info */}
      <Section icon={Key} title="Environment Variables">
        <div className="space-y-2">
          {[
            { key: 'DATABASE_URL', val: 'mysql+pymysql://root:****@localhost:3306/trustsphere', file: 'backend/.env' },
            { key: 'GEMINI_API_KEY', val: '(optional) for Gemini AI integration', file: 'backend/.env' },
            { key: 'VITE_API_BASE_URL', val: 'http://localhost:8000', file: 'frontend/.env' },
          ].map(({ key, val, file }) => (
            <div key={key} className="flex gap-3 p-3 rounded-lg bg-white/3 border border-white/5">
              <div className="flex-1 min-w-0">
                <code className="text-violet-400 text-xs font-mono">{key}</code>
                <p className="text-slate-400 text-xs truncate">{val}</p>
              </div>
              <span className="text-slate-600 text-xs flex-shrink-0">{file}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Module info */}
      <Section icon={Shield} title="Module Information">
        <div className="space-y-2 text-sm">
          {[
            { name: 'SourceMark', desc: 'SHA-256 file fingerprinting and tamper detection', endpoint: '/api/sourcemark' },
            { name: 'ProvenanceGuard', desc: 'Rollback protection, re-save detection, and signing key lifecycle defense', endpoint: '/api/provenanceguard' },
            { name: 'TrustTest AI', desc: 'Rule-based + optional Gemini AI prompt security testing', endpoint: '/api/trusttest' },
            { name: 'EvidenceLock', desc: 'Hash-chained tamper-evident audit log', endpoint: '/api/evidencelock' },
          ].map(({ name, desc, endpoint }) => (
            <div key={name} className="flex gap-3 p-3 rounded-lg bg-white/3 border border-white/5">
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium">{name}</p>
                <p className="text-slate-400 text-xs">{desc}</p>
              </div>
              <code className="text-violet-400 text-xs font-mono flex-shrink-0">{endpoint}</code>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="glass rounded-xl p-6 border border-violet-500/15">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-5">
        <Icon className="h-4 w-4 text-violet-400" />
        {title}
      </h3>
      {children}
    </div>
  )
}

