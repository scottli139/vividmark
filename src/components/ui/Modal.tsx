import { useEffect } from 'react'
import type { HTMLAttributes } from 'react'

interface ModalProps extends HTMLAttributes<HTMLDivElement> {
  onClose: () => void
  overlayClassName?: string
}

export function Modal({
  onClose,
  overlayClassName = '',
  className = '',
  children,
  onKeyDown,
  ...props
}: ModalProps) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-overlay ${overlayClassName}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={onKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        className={`rounded-lg border border-border bg-background p-6 text-foreground shadow-overlay ${className}`}
        {...props}
      >
        {children}
      </div>
    </div>
  )
}
