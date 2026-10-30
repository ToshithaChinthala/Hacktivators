import { motion } from 'framer-motion'

export default function StatCard({ icon: Icon, label, value, sub, color = 'purple', delay = 0 }) {
  const colors = {
    purple: 'from-violet-600/20 to-violet-900/10 border-violet-500/20 text-violet-400',
    blue: 'from-blue-600/20 to-blue-900/10 border-blue-500/20 text-blue-400',
    emerald: 'from-emerald-600/20 to-emerald-900/10 border-emerald-500/20 text-emerald-400',
    red: 'from-red-600/20 to-red-900/10 border-red-500/20 text-red-400',
    amber: 'from-amber-600/20 to-amber-900/10 border-amber-500/20 text-amber-400',
    cyan: 'from-cyan-600/20 to-cyan-900/10 border-cyan-500/20 text-cyan-400',
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className={`glass glass-hover rounded-xl p-5 bg-gradient-to-br ${colors[color]} border`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${colors[color]}`}>
          {Icon && <Icon className="h-5 w-5" />}
        </div>
      </div>
      <div className="text-2xl font-bold text-white mb-0.5">{value ?? '—'}</div>
      <div className="text-slate-400 text-sm font-medium">{label}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </motion.div>
  )
}

