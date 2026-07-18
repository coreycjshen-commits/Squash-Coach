import { forwardRef, type TextareaHTMLAttributes } from 'react'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...rest }, ref) => (
    <textarea
      ref={ref}
      className={`glass-field min-h-24 rounded-xl border border-white/12 px-3.5 py-2.5 text-text
        placeholder:text-muted/60 outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/25 ${className}`}
      {...rest}
    />
  ),
)
Textarea.displayName = 'Textarea'
