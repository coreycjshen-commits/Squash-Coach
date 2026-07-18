export interface RadioOption {
  value: string
  label: string
  description?: string
}

export function RadioCards({
  options, value, onChange, name,
}: {
  options: RadioOption[]
  value: string | null
  onChange: (v: string) => void
  name: string
}) {
  return (
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={name}>
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            type="button"
            key={o.value}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`rounded-2xl border p-4 text-left backdrop-blur-md transition ${
              selected
                ? 'border-accent/60 bg-accent/12 shadow-[0_8px_24px_-12px_rgba(234,165,62,0.5)]'
                : 'border-white/10 bg-white/[0.04] hover:border-white/25 hover:bg-white/[0.07]'
            }`}
          >
            <div className="font-medium text-text">{o.label}</div>
            {o.description && <div className="mt-1 text-sm text-muted">{o.description}</div>}
          </button>
        )
      })}
    </div>
  )
}
