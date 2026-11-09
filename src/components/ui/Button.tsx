import { forwardRef } from 'react'
import type { ButtonHTMLAttributes } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'icon'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:bg-accent-hover',
  secondary: 'border border-border bg-background text-foreground hover:bg-hover',
  ghost: 'text-secondary hover:bg-hover hover:text-foreground',
  danger: 'bg-danger text-on-accent hover:bg-danger-hover',
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-[var(--control-height-sm)] px-3 text-xs',
  md: 'h-[var(--control-height-md)] px-4 text-sm',
  icon: 'h-[var(--control-height-md)] w-[var(--control-height-md)] px-0 text-sm',
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', type = 'button', className = '', ...props },
  ref
) {
  return (
    <button
      ref={ref}
      type={type}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium transition-colors duration-[var(--duration-fast)] outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  )
})
