import { forwardRef } from 'react'
import type { InputHTMLAttributes } from 'react'

export type TextFieldSize = 'sm' | 'md'

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  inputSize?: TextFieldSize
  invalid?: boolean
}

const sizeClasses: Record<TextFieldSize, string> = {
  sm: 'h-[var(--control-height-sm)] px-2 text-[13px]',
  md: 'h-[var(--control-height-md)] px-2 text-sm',
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { inputSize = 'md', invalid = false, className = '', ...props },
  ref
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={`w-full rounded-md border bg-background text-foreground outline-none transition-colors duration-[var(--duration-fast)] placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-50 ${invalid ? 'border-danger' : 'border-border'} ${sizeClasses[inputSize]} ${className}`}
      {...props}
    />
  )
})
