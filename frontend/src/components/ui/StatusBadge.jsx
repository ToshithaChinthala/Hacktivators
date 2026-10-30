import { motion } from 'framer-motion'

export default function StatusBadge({ status }) {
  const map = {
    VERIFIED: { label: 'Verified', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    MATCH: { label: 'Match', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    MISMATCH: { label: 'Modified', cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
    MODIFIED: { label: 'Modified', cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
    PENDING: { label: 'Pending', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    LOW: { label: 'Low', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    MEDIUM: { label: 'Medium', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
    HIGH: { label: 'High', cls: 'bg-orange-500/10 text-orange-400 border-orange-500/30' },
    CRITICAL: { label: 'Critical', cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
    ELIGIBLE: { label: 'Eligible', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    NOT_ELIGIBLE: { label: 'Not Eligible', cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
    VALID: { label: 'Valid', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' },
    INVALID: { label: 'Invalid', cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
    REGISTERED: { label: 'Registered', cls: 'bg-violet-500/10 text-violet-400 border-violet-500/30' },
  }

  const entry = map[status?.toUpperCase()] || {
    label: status || 'Unknown',
    cls: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${entry.cls}`}
    >
      {entry.label}
    </span>
  )
}

