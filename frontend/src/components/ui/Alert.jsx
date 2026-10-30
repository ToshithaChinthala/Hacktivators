import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react'
import { useEffect } from 'react'

export default function Alert({ type = 'info', title, message, onClose, autoClose = 5000 }) {
  const configs = {
    success: { icon: CheckCircle, cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
    error: { icon: XCircle, cls: 'bg-red-500/10 border-red-500/30 text-red-400' },
    warning: { icon: AlertTriangle, cls: 'bg-amber-500/10 border-amber-500/30 text-amber-400' },
    info: { icon: Info, cls: 'bg-blue-500/10 border-blue-500/30 text-blue-400' },
  }

  const { icon: Icon, cls } = configs[type]

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
      className={`flex items-start gap-3 p-4 rounded-xl border ${cls} relative`}
    >
      <Icon className="h-5 w-5 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        {title && <div className="font-semibold text-sm mb-0.5">{title}</div>}
        {message && <div className="text-xs opacity-80 break-words">{message}</div>}
      </div>
      {onClose && (
        <button onClick={onClose} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <X className="h-4 w-4" />
        </button>
      )}
    </motion.div>
  )
}

