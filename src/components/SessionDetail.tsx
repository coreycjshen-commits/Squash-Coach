/** Render a session's free-form `detail` object as clean, readable lines (never raw JSON). */
export function SessionDetail({ detail }: { detail: Record<string, unknown> }) {
  const entries = Object.entries(detail).filter(([, v]) => v != null && v !== '')
  if (entries.length === 0) return null
  return (
    <dl className="mt-3 flex flex-col gap-2 border-t border-border pt-3 text-sm">
      {entries.map(([key, value]) => (
        <div key={key} className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
          <dt className="shrink-0 font-medium text-muted sm:w-28">{humanize(key)}</dt>
          <dd className="text-text">{renderValue(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function humanize(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/, (c) => c.toUpperCase())
}

function renderValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (item && typeof item === 'object') {
          const o = item as Record<string, unknown>
          if ('name' in o && ('sets' in o || 'reps' in o)) {
            const setsReps = [o.sets, o.reps].filter((x) => x != null).join('×')
            return setsReps ? `${o.name} — ${setsReps}` : String(o.name)
          }
          return Object.values(o).join(' ')
        }
        return String(item)
      })
      .join(' · ')
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([k, v]) => `${humanize(k)}: ${v}`)
      .join(' · ')
  }
  return String(value)
}
