import { Card } from './ui'
import type { Deltas } from '../lib/baseline'

function tone(value: number | null, goodIsUp: boolean): string {
  if (value == null) return 'text-muted'
  const good = goodIsUp ? value >= 0 : value <= 0
  return good ? 'text-accent' : 'text-red-400'
}
function fmt(v: number | null, unit = ''): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v}${unit}`
}

export function RecoverySnapshot({ deltas, acwr }: { deltas: Deltas; acwr: number | null }) {
  const acwrTone = acwr == null ? 'text-muted' : acwr > 1.5 || acwr < 0.8 ? 'text-red-400' : 'text-accent'
  return (
    <Card>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Recovery vs. your baseline</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="HRV" value={fmt(deltas.hrv_delta, ' ms')} tone={tone(deltas.hrv_delta, true)} />
        <Stat label="Resting HR" value={fmt(deltas.rhr_delta, ' bpm')} tone={tone(deltas.rhr_delta, false)} />
        <Stat label="Sleep" value={fmt(deltas.sleep_delta, ' h')} tone={tone(deltas.sleep_delta, true)} />
        <Stat label="Load ratio" value={acwr == null ? '—' : acwr.toFixed(2)} tone={acwrTone} />
      </div>
      <p className="mt-3 text-xs text-muted">
        Deltas are today vs. your 7-day average. Load ratio (acute:chronic) above ~1.5 means you're ramping up fast.
      </p>
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`font-display text-xl font-semibold ${tone}`}>{value}</div>
    </div>
  )
}
