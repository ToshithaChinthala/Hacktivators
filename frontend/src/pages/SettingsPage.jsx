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
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">API Base URL</label>
            <input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 text-sm focus:bg-white focus:outline-none focus:border-indigo-500 transition-colors font-mono"
            />
            <p className="text-slate-500 text-xs mt-1">Set VITE_API_BASE_URL in frontend/.env to change permanently</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={checkHealth}
              disabled={checking}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 shadow-xs"
            >
              {checking ? 'Checking…' : 'Check API Health'}
            </button>
            <a
              href={`${apiUrl}/docs`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />Swagger Docs
            </a>
            <a
              href="http://localhost:5555"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <ExternalLink className="h-3.5 w-3.5" />Prisma Studio
            </a>
          </div>
          {health && (
            <pre className="bg-slate-50 rounded-lg p-4 text-xs text-slate-800 font-mono border border-slate-200 overflow-auto">
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
            <div key={key} className="flex gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex-1 min-w-0">
                <code className="text-indigo-600 text-xs font-mono font-semibold">{key}</code>
                <p className="text-slate-600 text-xs truncate mt-0.5">{val}</p>
              </div>
              <span className="text-slate-400 text-xs flex-shrink-0 font-medium">{file}</span>
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
            <div key={name} className="flex gap-3 p-3 rounded-lg bg-slate-50 border border-slate-200">
              <div className="flex-1 min-w-0">
                <p className="text-slate-900 text-xs font-semibold">{name}</p>
                <p className="text-slate-500 text-xs">{desc}</p>
              </div>
              <code className="text-indigo-600 text-xs font-mono font-medium flex-shrink-0">{endpoint}</code>
            </div>
          ))}
        </div>
      </Section>
    </div>
  )
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs">
      <h3 className="text-slate-900 font-semibold flex items-center gap-2 mb-5 text-sm">
        <Icon className="h-4 w-4 text-indigo-600" />
        {title}
      </h3>
      {children}
    </div>
  )
}
