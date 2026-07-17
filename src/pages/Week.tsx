import { useEffect, useState } from 'react'
import { useSession } from '../auth/useSession'
import { loadCurrentWeek, generateWeek, updateSession, type WeekPlan, type SessionRow } from '../lib/plans'
import { Button, Card, Input, Field } from '../components/ui'
import { SessionDetail } from '../components/SessionDetail'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const TYPE_LABEL: Record<SessionRow['type'], string> = {
  oncourt: 'On-court', strength: 'Strength', cardio: 'Cardio', rest: 'Rest',
}

function dayLabel(iso: string): string {
  const dow = (new Date(Date.parse(iso)).getUTCDay() + 6) % 7
  return DAYS[dow]
}

export default function Week() {
  const { session } = useSession()
  const uid = session?.user?.id
  const [plan, setPlan] = useState<WeekPlan | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)

  async function refresh() {
    if (!uid) return
    setLoading(true)
    try {
      setPlan(await loadCurrentWeek(uid))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load plan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  async function generate() {
    setBusy(true)
    setError(null)
    const r = await generateWeek()
    setBusy(false)
    if (!r.ok) return setError(r.error ?? 'Generation failed')
    await refresh()
  }

  if (loading) return <Card><p className="text-muted">Loading…</p></Card>

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold">This week</h1>
            {plan && <p className="text-sm text-muted">{plan.phase} · week of {plan.week_start}</p>}
          </div>
          <Button onClick={generate} disabled={busy}>
            {busy ? 'Building…' : plan ? 'Re-plan' : 'Generate plan'}
          </Button>
        </div>
        {plan?.rationale && <p className="mt-3 text-sm text-muted">{plan.rationale}</p>}
        {plan?.generated_by === 'fallback' && (
          <p className="mt-2 text-xs text-amber-400/80">Built from the offline template (the coach model was unavailable).</p>
        )}
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </Card>

      {!plan && !error && (
        <Card><p className="text-muted">No plan yet for this week. Hit “Generate plan”.</p></Card>
      )}

      {plan?.sessions.map((s) => (
        <Card key={s.id}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-accent">
                {dayLabel(s.day)} · {TYPE_LABEL[s.type]}
              </p>
              <p className="mt-1 font-medium">{s.focus}</p>
              <p className="text-sm text-muted">
                {s.duration_min} min · RPE {s.target_rpe}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setEditing(editing === s.id ? null : s.id)}>
              {editing === s.id ? 'Close' : 'Edit'}
            </Button>
          </div>

          {s.detail && <SessionDetail detail={s.detail} />}

          {editing === s.id && (
            <SessionEditor session={s} onSaved={async () => { setEditing(null); await refresh() }} />
          )}
        </Card>
      ))}
    </div>
  )
}

function SessionEditor({ session, onSaved }: { session: SessionRow; onSaved: () => void }) {
  const [focus, setFocus] = useState(session.focus ?? '')
  const [duration, setDuration] = useState(String(session.duration_min ?? ''))
  const [rpe, setRpe] = useState(String(session.target_rpe ?? ''))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    try {
      await updateSession(session.id, {
        focus: focus.trim() === '' ? null : focus,
        duration_min: duration === '' ? null : Number(duration),
        target_rpe: rpe === '' ? null : Number(rpe),
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this session.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
      <Field label="Focus" htmlFor={`f-${session.id}`}>
        <Input id={`f-${session.id}`} value={focus} onChange={(e) => setFocus(e.target.value)} />
      </Field>
      <div className="flex gap-3">
        <Field label="Duration (min)" htmlFor={`d-${session.id}`}>
          <Input id={`d-${session.id}`} type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </Field>
        <Field label="Target RPE" htmlFor={`r-${session.id}`}>
          <Input id={`r-${session.id}`} type="number" min="1" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} />
        </Field>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save session'}</Button></div>
    </div>
  )
}
