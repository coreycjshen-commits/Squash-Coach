import { forwardRef, type SelectHTMLAttributes } from 'react'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <select
      ref={ref}
      className={`glass-field rounded-xl border border-white/12 px-3.5 py-2.5 text-text
        outline-none focus:border-accent/70 focus:ring-2 focus:ring-accent/25 [&>option]:bg-[rgb(18_24_40)] ${className}`}
      {...rest}
    >
      {children}
    </select>
  ),
)
Select.displayName = 'Select'
