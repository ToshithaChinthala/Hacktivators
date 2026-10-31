export default function StatusBadge({ status }) {
  const map = {
    VERIFIED: { label: 'Verified', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
    MATCH: { label: 'Match', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
    MISMATCH: { label: 'Modified', cls: 'bg-rose-50 text-rose-700 border-rose-200/80' },
    MODIFIED: { label: 'Modified', cls: 'bg-rose-50 text-rose-700 border-rose-200/80' },
    PENDING: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 border-amber-200/80' },
    LOW: { label: 'Low', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
    MEDIUM: { label: 'Medium', cls: 'bg-amber-50 text-amber-700 border-amber-200/80' },
    HIGH: { label: 'High', cls: 'bg-orange-50 text-orange-700 border-orange-200/80' },
    CRITICAL: { label: 'Critical', cls: 'bg-rose-50 text-rose-700 border-rose-200/80' },
    ELIGIBLE: { label: 'Eligible', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
    NOT_ELIGIBLE: { label: 'Not Eligible', cls: 'bg-rose-50 text-rose-700 border-rose-200/80' },
    VALID: { label: 'Valid', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200/80' },
    INVALID: { label: 'Invalid', cls: 'bg-rose-50 text-rose-700 border-rose-200/80' },
    REGISTERED: { label: 'Registered', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200/80' },
  }

  const entry = map[status?.toUpperCase()] || {
    label: status || 'Unknown',
    cls: 'bg-slate-50 text-slate-700 border-slate-200',
  }

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${entry.cls}`}
    >
      {entry.label}
    </span>
  )
}
