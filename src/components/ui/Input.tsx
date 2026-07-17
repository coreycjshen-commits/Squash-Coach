import { forwardRef, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, id, className = '', ...rest }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-muted">
          {label}
        </label>
      )}
      <input
        id={id}
        ref={ref}
        className={`rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-text
          placeholder:text-muted/60 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 ${className}`}
        {...rest}
      />
    </div>
  ),
)
Input.displayName = 'Input'
