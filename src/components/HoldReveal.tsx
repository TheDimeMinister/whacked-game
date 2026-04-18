import { motion } from 'framer-motion'
import { useCallback, useState, type ReactNode } from 'react'

type Props = {
  label: string
  children: ReactNode
  className?: string
}

function pulseVibrate() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(12)
  }
}

export function HoldReveal({ label, children, className }: Props) {
  const [open, setOpen] = useState(false)

  const start = useCallback(() => {
    pulseVibrate()
    setOpen(true)
  }, [])

  const end = useCallback(() => {
    setOpen(false)
  }, [])

  return (
    <div className={`hold-reveal ${className ?? ''}`}>
      <p className="hold-reveal__label">{label}</p>
      <motion.button
        type="button"
        className="hold-reveal__pad"
        aria-pressed={open}
        onPointerDown={start}
        onPointerUp={end}
        onPointerLeave={end}
        onPointerCancel={end}
        whileTap={{ scale: 0.98 }}
        animate={
          open
            ? {
                boxShadow:
                  '0 0 28px color-mix(in srgb, var(--accent) 55%, transparent)',
              }
            : { boxShadow: '0 0 0 transparent' }
        }
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      >
        <span className="hold-reveal__hint">Press &amp; hold to reveal</span>
        {open ? (
          <motion.div
            className="hold-reveal__content"
            initial={{ opacity: 0, filter: 'blur(6px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0 }}
          >
            {children}
          </motion.div>
        ) : (
          <span className="hold-reveal__hidden">••••••</span>
        )}
      </motion.button>
    </div>
  )
}
