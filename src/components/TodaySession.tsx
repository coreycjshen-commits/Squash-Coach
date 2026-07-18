import { Card } from './ui'
import { SessionDetail } from './SessionDetail'
import { pickSoloDrill, type SoloDrill } from '../lib/solo'
import type { TodaySessionRow } from '../lib/checkin'

const TYPE_LABEL: Record<string, string> = { oncourt: 'On-court', strength: 'Strength', cardio: 'Cardio', rest: 'Rest' }

export function TodaySession({
  session, noPartner, drills,
}: { session: TodaySessionRow; noPartner: boolean; drills: SoloDrill[] }) {
  const needsSwap = noPartner && session.type === 'oncourt'
  const solo = needsSwap ? pickSoloDrill(session, drills) : null

  return (
    <Card>
      <p className="text-xs font-medium uppercase tracking-wide text-accent">Today · {TYPE_LABEL[session.type] ?? session.type}</p>
      <p className="mt-1 text-lg font-semibold">{session.focus}</p>
      <p className="text-sm text-muted">{session.duration_min} min · RPE {session.target_rpe}</p>
      {session.detail && <SessionDetail detail={session.detail} />}

      {needsSwap && (
        <div className="mt-4 rounded-xl border border-accent/40 bg-accent/10 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-accent">No partner — solo substitution</p>
          {solo ? (
            <>
              <p className="mt-1 font-medium">{solo.name}</p>
              <p className="text-sm text-muted">
                {solo.duration_min ? `${solo.duration_min} min` : ''}{solo.target_intensity ? ` · RPE ${solo.target_intensity}` : ''} · same focus as your planned court session
              </p>
              {solo.structure && Object.keys(solo.structure).length > 0 && (
                <SessionDetail detail={solo.structure} />
              )}
            </>
          ) : (
            <p className="mt-1 text-sm text-muted">No matching solo drill found — do a technical/ghosting session at a similar intensity.</p>
          )}
        </div>
      )}
    </Card>
  )
}
