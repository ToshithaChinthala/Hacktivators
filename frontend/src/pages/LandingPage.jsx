import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  Shield, Key, Zap, Lock, ArrowRight, CheckCircle,
  Activity, Database, Globe, ChevronRight
} from 'lucide-react'

const modules = [
  {
    icon: Shield,
    name: 'SourceMark',
    desc: 'SHA-256 content fingerprinting & tamper detection for files and documents.',
    color: 'from-violet-600/20 to-violet-900/10 border-violet-500/25',
    iconColor: 'text-violet-400',
  },
  {
    icon: Key,
    name: 'PrivyPass',
    desc: 'Selective-disclosure credential verification without exposing raw personal data.',
    color: 'from-blue-600/20 to-blue-900/10 border-blue-500/25',
    iconColor: 'text-blue-400',
  },
  {
    icon: Zap,
    name: 'TrustTest AI',
    desc: 'Real-time AI prompt-injection detection and security risk classification.',
    color: 'from-amber-600/20 to-amber-900/10 border-amber-500/25',
    iconColor: 'text-amber-400',
  },
  {
    icon: Lock,
    name: 'EvidenceLock',
    desc: 'Hash-chained tamper-evident audit log for digital evidence management.',
    color: 'from-emerald-600/20 to-emerald-900/10 border-emerald-500/25',
    iconColor: 'text-emerald-400',
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
    <div className="min-h-screen bg-[#0a0e1a] text-white">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-violet-500/10 glass">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-600 to-blue-600 flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-white">TrustSphere AI</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-slate-400 hover:text-white text-sm transition-colors">Sign In</Link>
            <Link
              to="/dashboard"
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-600/10 border border-violet-500/25 text-violet-400 text-xs font-medium mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400 pulse-dot" />
              Hackathon Edition — Live Demo
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
              <span className="gradient-text">Trust Everything.</span>
              <br />
              Verify Nothing Less.
            </h1>
            <p className="text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed mb-8">
              TrustSphere AI is an integrated cybersecurity platform for content integrity,
              privacy-preserving verification, AI security testing, and tamper-evident evidence management.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/dashboard"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold hover:opacity-90 transition-all glow-purple"
              >
                Open Dashboard <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl glass border border-violet-500/25 text-slate-300 font-medium hover:text-white transition-colors"
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
            <h2 className="text-3xl font-bold text-white mb-3">Four Core Modules</h2>
            <p className="text-slate-400">End-to-end trust infrastructure for the modern enterprise</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {modules.map((m, i) => (
              <motion.div
                key={m.name}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
                className={`glass glass-hover rounded-xl p-6 bg-gradient-to-br ${m.color} border`}
              >
                <m.icon className={`h-7 w-7 mb-4 ${m.iconColor}`} />
                <h3 className="text-white font-bold mb-2">{m.name}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{m.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-6 border-y border-violet-500/10">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-white mb-3">How It Works</h2>
            <p className="text-slate-400">A four-step trust verification pipeline</p>
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
                <div className="text-4xl font-black gradient-text mb-3">{s.n}</div>
                <h4 className="text-white font-semibold mb-2">{s.title}</h4>
                <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
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
              <h2 className="text-3xl font-bold text-white mb-4">Platform Benefits</h2>
              <p className="text-slate-400 mb-8 leading-relaxed">
                Built for hackathon demonstration: every feature runs locally with MySQL persistence,
                real WebSocket updates, and no fake data.
              </p>
              <ul className="space-y-3">
                {benefits.map((b) => (
                  <li key={b} className="flex items-center gap-3 text-slate-300 text-sm">
                    <CheckCircle className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="glass rounded-2xl p-6 border border-violet-500/20">
              <div className="flex items-center gap-2 mb-4">
                <div className="h-3 w-3 rounded-full bg-red-400" />
                <div className="h-3 w-3 rounded-full bg-amber-400" />
                <div className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="text-slate-500 text-xs ml-2">localhost:8000/api/health</span>
              </div>
              <pre className="text-xs text-slate-300 font-mono leading-relaxed">
{`{
  "status": "healthy",
  "database": "connected",
  "modules": {
    "sourcemark": "active",
    "privypass": "active",
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
      <section className="py-16 px-6 text-center">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to Explore?</h2>
          <p className="text-slate-400 mb-8">Open the live dashboard and start testing all four modules.</p>
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 text-white font-semibold hover:opacity-90 transition-all glow-purple"
          >
            Open Dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-violet-500/10 py-8 px-6 text-center text-slate-500 text-sm">
        <p>TrustSphere AI — Hackathon Edition · Built with React, FastAPI, MySQL</p>
      </footer>
    </div>
  )
}

