import { Card } from './ui'
import type { RpePoint } from '../lib/progress'

export function RpeTrend({ points }: { points: RpePoint[] }) {
  if (points.length === 0) {
    return (
      <Card>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted">RPE trend</h2>
        <p className="text-sm text-muted">Log a few sessions and your intensity trend shows up here.</p>
      </Card>
    )
  }
  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted">RPE trend (last {points.length} sessions)</h2>
      <div className="flex h-32 items-end gap-1.5">
        {points.map((p, i) => (
          <div key={`${p.date}-${i}`} className="flex flex-1 flex-col items-center gap-1" title={`${p.date}: RPE ${p.rpe}`}>
            <div className="w-full rounded-t bg-accent/80" style={{ height: `${(p.rpe / 10) * 100}%` }} />
            <span className="text-[10px] text-muted">{p.rpe}</span>
          </div>
        ))}
      </div>
    </Card>
  )
}
