import { Card } from './ui'
import { SessionDetail } from './SessionDetail'

const LABEL: Record<string, string> = {
  keep: 'Keep as planned', scale_down: 'Scale down', scale_up: 'Scale up',
  change_modality: 'Change it up', rest: 'Rest day',
}
const TYPE_LABEL: Record<string, string> = { oncourt: 'On-court', strength: 'Strength', cardio: 'Cardio', rest: 'Rest' }

interface Adjusted { type: string; focus: string; duration_min: number | null; target_rpe: number | null; detail?: Record<string, unknown> }

export function DecisionCard({ decision, rationale, adjusted }: {
  decision: string; rationale: string; adjusted: Adjusted | null
}) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-accent">
          Coach: {LABEL[decision] ?? decision}
        </span>
      </div>
      <p className="mt-3 text-sm text-text">{rationale}</p>
      {adjusted && decision !== 'keep' && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">Do this instead · {TYPE_LABEL[adjusted.type] ?? adjusted.type}</p>
          <p className="mt-1 font-medium">{adjusted.focus}</p>
          <p className="text-sm text-muted">{adjusted.duration_min} min · RPE {adjusted.target_rpe}</p>
          {adjusted.detail && <SessionDetail detail={adjusted.detail} />}
        </div>
      )}
    </Card>
  )
}
