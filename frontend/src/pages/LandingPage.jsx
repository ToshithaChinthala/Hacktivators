import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Shield, ShieldCheck, Zap, Lock, ArrowRight, CheckCircle,
  Activity, Database, Globe, ChevronRight
} from 'lucide-react'

const modules = [
  {
    icon: Shield,
    name: 'SourceMark',
    desc: 'SHA-256 content fingerprinting & tamper detection for files and documents.',
    iconColor: 'text-indigo-600',
    iconBg: 'bg-indigo-50 border-indigo-200',
  },
  {
    icon: ShieldCheck,
    name: 'ProvenanceGuard',
    desc: 'Rollback protection with filesystem witness, slide & image re-save detection, and signing key defense.',
    iconColor: 'text-blue-600',
    iconBg: 'bg-blue-50 border-blue-200',
  },
  {
    icon: Zap,
    name: 'TrustTest AI',
    desc: 'Real-time AI prompt-injection detection and security risk classification.',
    iconColor: 'text-amber-600',
    iconBg: 'bg-amber-50 border-amber-200',
  },
  {
    icon: Lock,
    name: 'EvidenceLock',
    desc: 'Hash-chained tamper-evident audit log for digital evidence management.',
    iconColor: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border-emerald-200',
  },
]

const steps = [
  { n: '01', title: 'Upload or Submit', desc: 'Upload files, input credentials, or send AI prompts to the platform.' },
  { n: '02', title: 'Compute & Verify', desc: 'Backend generates SHA-256 fingerprints and runs heuristic analysis.' },
  { n: '03', title: 'Record & Log', desc: 'All events are persisted in MySQL and linked into an audit chain.' },
  { n: '04', title: 'Report & Visualize', desc: 'Real-time dashboard updates and downloadable trust reports.' },
]

const benefits = [
  'SHA-256 tamper detection on every file',
  'Privacy-preserving selective disclosure',
  'AI prompt-injection risk scoring',
  'Hash-chained tamper-evident logs',
  'Live WebSocket dashboard updates',
  'MySQL-backed persistent audit trail',
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#f8f9fe] text-slate-900">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight text-lg">TrustSphere AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors">Sign In</Link>
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors shadow-xs"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-36 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold mb-6">
              <span className="h-2 w-2 rounded-full bg-indigo-600" />
              Hackathon Edition — Live Demo
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6 text-slate-900 tracking-tight">
              <span>Trust Everything.</span>
              <br />
              <span className="gradient-text">Verify Nothing Less.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8">
              TrustSphere AI is an integrated cybersecurity platform for content integrity,
              privacy-preserving verification, AI security testing, and tamper-evident evidence management.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/dashboard"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all shadow-md shadow-indigo-600/20"
              >
                Open Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors shadow-xs"
              >
                API Docs <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Modules */}
      <section className="py-16 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">Four Core Modules</h2>
            <p className="text-slate-500">End-to-end trust infrastructure for the modern enterprise</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {modules.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className="bg-white rounded-xl p-6 border border-slate-200/80 shadow-xs hover:shadow-md transition-all"
              >
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center mb-4 border ${m.iconBg}`}>
                  <m.icon className={`h-6 w-6 ${m.iconColor}`} />
                </div>
                <h3 className="text-slate-900 font-bold mb-2 text-base">{m.name}</h3>
                <p className="text-slate-600 text-xs leading-relaxed">{m.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 border-y border-slate-200 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-slate-900 mb-3 tracking-tight">How It Works</h2>
            <p className="text-slate-500">A four-step trust verification pipeline</p>
          </div>
          <div className="grid md:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <motion.div
                key={s.n}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="text-center"
              >
                <div className="text-4xl font-black text-indigo-600 mb-3 font-mono">{s.n}</div>
                <h4 className="text-slate-900 font-semibold mb-2">{s.title}</h4>
                <p className="text-slate-500 text-xs leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Platform Benefits</h2>
              <p className="text-slate-600 mb-8 leading-relaxed text-sm">
                Built for hackathon demonstration: every feature runs locally with MySQL persistence,
                real WebSocket updates, and authenticated actor-level isolation.
              </p>
              <ul className="space-y-3">
                {benefits.map((b) => (
                  <li key={b} className="flex items-center gap-3 text-slate-700 text-sm font-medium">
                    <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl text-white">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-3 rounded-full bg-rose-500" />
                <div className="h-3 w-3 rounded-full bg-amber-500" />
                <div className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="text-slate-400 text-xs ml-2 font-mono">localhost:8000/api/health</span>
              </div>
              <pre className="text-xs text-slate-300 font-mono leading-relaxed overflow-x-auto">
{`{
  "status": "healthy",
  "database": "connected",
  "modules": {
    "sourcemark": "active",
    "provenanceguard": "active",
    "trusttest": "active",
    "evidencelock": "active"
  },
  "websocket": "running"
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-6 text-center bg-white border-t border-slate-200">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-slate-900 mb-4 tracking-tight">Ready to Explore?</h2>
          <p className="text-slate-600 mb-8 text-sm">Open the live dashboard and start testing all four modules.</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-all shadow-md shadow-indigo-600/20"
          >
            Open Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 py-8 px-6 text-center text-slate-500 text-xs bg-slate-50">
        <p>TrustSphere AI — Enterprise Cybersecurity Platform · Built with React, FastAPI, MySQL</p>
      </footer>
    </div>
  )
}
