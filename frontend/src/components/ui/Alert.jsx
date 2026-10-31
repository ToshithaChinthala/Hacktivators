import { motion } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useEffect } from 'react'

export default function Alert({ type = 'info', title, message, onClose, autoClose = 5000 }) {
  const configs = {
    success: { icon: CheckCircle, cls: 'bg-emerald-50 border-emerald-200/80 text-emerald-800' },
    error: { icon: XCircle, cls: 'bg-rose-50 border-rose-200/80 text-rose-800' },
    warning: { icon: AlertTriangle, cls: 'bg-amber-50 border-amber-200/80 text-amber-800' },
    info: { icon: Info, cls: 'bg-blue-50 border-blue-200/80 text-blue-800' },
  }

  const { icon: Icon, cls } = configs[type] || configs.info

  useEffect(() => {
    if (autoClose && onClose) {
      const t = setTimeout(onClose, autoClose)
      return () => clearTimeout(t)
    }
  }, [autoClose, onClose])

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`flex items-start gap-3 p-4 rounded-xl border ${cls} shadow-xs relative`}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold text-sm mb-0.5">{title}</div>}
        {message && <div className="text-xs opacity-90 break-words">{message}</div>}
      </div>
      {onClose && (
        <button onClick={onClose} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  )
}
