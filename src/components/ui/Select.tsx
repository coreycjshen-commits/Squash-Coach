import { forwardRef, type SelectHTMLAttributes } from 'react'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <select
      ref={ref}
      className={`rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-text
        outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 ${className}`}
      {...rest}
    >
      {children}
    </select>
  ),
)
Select.displayName = 'Select'
