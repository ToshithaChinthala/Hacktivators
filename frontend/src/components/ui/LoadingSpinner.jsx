import { motion } from 'framer-motion'

export default function LoadingSpinner({ size = 'md', text }) {
  const sizes = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' }
  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <motion.div
        className={`${sizes[size]} border-2 border-indigo-100 border-t-indigo-600 rounded-full`}
        animate={{ rotate: 360 }}
        transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
      />
      {text && <p className="text-slate-500 text-sm font-medium">{text}</p>}
    </div>
  )
}
