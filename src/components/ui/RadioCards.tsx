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
            className={`rounded-2xl border p-4 text-left transition ${
              selected
                ? 'border-accent bg-accent/10'
                : 'border-border bg-surface hover:border-muted'
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
