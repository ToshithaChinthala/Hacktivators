import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Activity, Eye, EyeOff, ArrowRight, UserPlus, LogIn } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ email: '', password: '', name: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { login, register, isAuthenticated } = useAuth()

  if (isAuthenticated) {
    navigate('/dashboard', { replace: true })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.email || !form.password) {
      toast.error('Please enter your email and password')
      return
    }
    if (mode === 'register' && form.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        await login(form.email, form.password)
        toast.success('Welcome back to TrustSphere AI!')
      } else {
        await register(form.email, form.password, form.name || form.email.split('@')[0])
        toast.success('Account created successfully!')
      }
      navigate('/dashboard', { replace: true })
    } catch (err) {
      const detail = err.response?.data?.detail || (mode === 'login' ? 'Failed to sign in' : 'Registration failed')
      toast.error(detail)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#f8f9fe] flex items-center justify-center px-4 relative overflow-hidden">
      {/* Background soft lavender glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-200/30 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-violet-200/30 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-600/20">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">TrustSphere AI</span>
          </Link>
          <p className="text-slate-500 text-sm">
            {mode === 'login' ? 'Sign in to access your secure flows' : 'Create an account to start your evidence flow'}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-8 border border-slate-200/80 shadow-xl shadow-slate-200/50">
          {/* Mode Switcher */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl border border-slate-200/80 mb-6">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                mode === 'login'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="h-3.5 w-3.5" />
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
                mode === 'register'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Full Name (optional)</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Alice Smith"
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:border-indigo-500 transition-colors"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder={mode === 'login' ? 'demo@trustsphere.ai' : 'user@example.com'}
                className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full bg-slate-50/70 border border-slate-200 rounded-lg px-4 py-2.5 text-slate-900 placeholder-slate-400 text-sm focus:bg-white focus:outline-none focus:border-indigo-500 transition-colors pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {mode === 'register' && (
                <p className="text-[11px] text-slate-500 mt-1">Minimum 6 characters with secure bcrypt hashing.</p>
              )}
            </div>

            {mode === 'login' && (
              <div className="px-3 py-2 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-900 text-xs">
                Admin demo: <span className="font-mono font-semibold text-indigo-700">demo@trustsphere.ai</span> / <span className="font-mono font-semibold text-indigo-700">demo123</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors disabled:opacity-50 shadow-xs"
            >
              {loading ? (
                <span>{mode === 'login' ? 'Signing in…' : 'Creating account…'}</span>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-slate-500 text-xs mt-6">
            <Link to="/" className="text-indigo-600 hover:text-indigo-700 font-medium transition-colors">
              ← Back to home
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
