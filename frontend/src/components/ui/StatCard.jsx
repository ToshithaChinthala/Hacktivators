import { motion } from 'framer-motion'

export default function StatCard({ icon: Icon, label, value, sub, color = 'indigo', delay = 0 }) {
  const colors = {
    purple: {
      badge: 'bg-purple-50 text-purple-700 border-purple-200/60',
      border: 'border-slate-200/80 hover:border-purple-300',
      shadow: 'hover:shadow-purple-500/5',
    },
    indigo: {
      badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/60',
      border: 'border-slate-200/80 hover:border-indigo-300',
      shadow: 'hover:shadow-indigo-500/5',
    },
    blue: {
      badge: 'bg-blue-50 text-blue-700 border-blue-200/60',
      border: 'border-slate-200/80 hover:border-blue-300',
      shadow: 'hover:shadow-blue-500/5',
    },
    emerald: {
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
      border: 'border-slate-200/80 hover:border-emerald-300',
      shadow: 'hover:shadow-emerald-500/5',
    },
    red: {
      badge: 'bg-rose-50 text-rose-700 border-rose-200/60',
      border: 'border-slate-200/80 hover:border-rose-300',
      shadow: 'hover:shadow-rose-500/5',
    },
    amber: {
      badge: 'bg-amber-50 text-amber-700 border-amber-200/60',
      border: 'border-slate-200/80 hover:border-amber-300',
      shadow: 'hover:shadow-amber-500/5',
    },
    cyan: {
      badge: 'bg-cyan-50 text-cyan-700 border-cyan-200/60',
      border: 'border-slate-200/80 hover:border-cyan-300',
      shadow: 'hover:shadow-cyan-500/5',
    },
  }

  const theme = colors[color] || colors.indigo

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={`bg-white rounded-xl p-5 border ${theme.border} shadow-xs transition-all duration-200 ${theme.shadow}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2.5 rounded-lg border ${theme.badge}`}>
          {Icon && <Icon className="h-5 w-5" />}
        </div>
      </div>
      <div className="text-2xl font-bold text-slate-900 tracking-tight mb-0.5">{value ?? '—'}</div>
      <div className="text-slate-600 text-sm font-medium">{label}</div>
      {sub && <div className="text-xs text-slate-400 mt-1">{sub}</div>}
    </motion.div>
  )
}
