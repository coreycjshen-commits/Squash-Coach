import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../auth/useSession'
import { loadTodayContext, saveCheckin, completeSession, type TodayContext } from '../lib/checkin'
import { RecoverySnapshot } from '../components/RecoverySnapshot'
import { TodaySession } from '../components/TodaySession'
import { CheckinForm } from '../components/CheckinForm'
import { CompleteSessionForm } from '../components/CompleteSessionForm'
import { Card } from '../components/ui'

export default function Today() {
  const { session: auth } = useSession()
  const uid = auth?.user?.id
  const [ctx, setCtx] = useState<TodayContext | null>(null)
  const [loading, setLoading] = useState(true)

  async function refresh() {
    if (!uid) return
    setLoading(true)
    try {
      setCtx(await loadTodayContext(uid))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  if (loading || !ctx) return <Card><p className="text-muted">Loading…</p></Card>

  const noPartner = ctx.checkin ? ctx.checkin.partner_available === false : false

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">Today</h1>
        <p className="text-sm text-muted">{ctx.date}</p>
      </div>

      {!ctx.checkin && (
        <CheckinForm onSubmit={async (input) => { await saveCheckin(uid!, input); await refresh() }} />
      )}

      {ctx.checkin && <RecoverySnapshot deltas={{ hrv_delta: ctx.checkin.hrv_delta, rhr_delta: ctx.checkin.rhr_delta, sleep_delta: ctx.checkin.sleep_delta }} acwr={ctx.checkin.acwr} />}

      {ctx.session
        ? <TodaySession session={ctx.session} noPartner={noPartner} drills={ctx.drills} />
        : (
          <Card>
            <p className="text-muted">No session planned for today.</p>
            <Link to="/week" className="mt-2 inline-block text-sm text-accent">Generate this week's plan →</Link>
          </Card>
        )}

      {ctx.checkin && ctx.session && !ctx.completion && (
        <CompleteSessionForm
          defaultType={ctx.session.type}
          defaultDuration={ctx.session.duration_min}
          onSubmit={async (i) => { await completeSession(uid!, { session_id: ctx.session!.id, adjustment: 'keep', ...i }); await refresh() }}
        />
      )}

      {ctx.completion && (
        <Card>
          <p className="text-sm text-accent">Logged today's session ✓</p>
          <p className="text-sm text-muted">{ctx.completion.actual_type} · {ctx.completion.actual_duration ?? '—'} min · RPE {ctx.completion.actual_rpe ?? '—'}</p>
        </Card>
      )}
    </div>
  )
}
