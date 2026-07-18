import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const styles: Record<Variant, string> = {
  primary:
    'bg-gradient-to-b from-accent-2 to-accent text-accent-fg shadow-[0_8px_22px_-8px_rgba(234,165,62,0.6)] hover:brightness-105 active:brightness-95',
  secondary:
    'glass-field text-text ring-1 ring-inset ring-white/12 hover:bg-white/10',
  ghost: 'bg-transparent text-muted hover:text-text',
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', className = '', ...rest }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold
        transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    />
  ),
)
Button.displayName = 'Button'
