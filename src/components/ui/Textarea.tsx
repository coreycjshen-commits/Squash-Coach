import { forwardRef, type TextareaHTMLAttributes } from 'react'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...rest }, ref) => (
    <textarea
      ref={ref}
      className={`min-h-24 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-text
        placeholder:text-muted/60 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 ${className}`}
      {...rest}
    />
  ),
)
Textarea.displayName = 'Textarea'
