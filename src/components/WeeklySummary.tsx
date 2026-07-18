import { Card } from './ui'
import type { WeekProgress } from '../lib/progressStats'

const DECISION_LABEL: Record<string, string> = {
  scale_down: 'scaled down', scale_up: 'scaled up', change_modality: 'changed', rest: 'rest',
}

export function WeeklySummary({ summary }: { summary: WeekProgress }) {
  const types = Object.entries(summary.byType)
  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted">This week</h2>
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Completed" value={`${summary.completed}/${summary.planned}`} />
        <Stat label="Adherence" value={`${summary.adherencePct}%`} accent />
        <Stat label="Avg RPE" value={summary.avgActualRpe != null ? String(summary.avgActualRpe) : '—'} />
      </div>

      {types.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {types.map(([t, n]) => (
            <span key={t} className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">
              {t}: {n}
            </span>
          ))}
        </div>
      )}

      {summary.adjustments.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Coach adjustments</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {summary.adjustments.map((a) => (
              <li key={a.date} className="flex justify-between">
                <span className="text-muted">{a.date}</span>
                <span className="text-accent">{DECISION_LABEL[a.decision] ?? a.decision}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold ${accent ? 'text-accent' : 'text-text'}`}>{value}</div>
    </div>
  )
}
