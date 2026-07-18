import { useState } from 'react'
import { Button, Card, Input, Field, Textarea, Select } from './ui'
import type { CheckinInput } from '../lib/checkin'

const numOrNull = (v: string) => (v.trim() === '' ? null : Number(v))

export function CheckinForm({ onSubmit }: { onSubmit: (input: CheckinInput) => Promise<void> }) {
  const [f, setF] = useState({
    resting_hr: '', hrv: '', sleep_hours: '', sleep_quality: '3', yesterday_rpe: '',
    partner: true, court: true, minutes: '', journal: '',
  })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof f>) => setF((p) => ({ ...p, ...patch }))

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        resting_hr: numOrNull(f.resting_hr),
        hrv: numOrNull(f.hrv),
        sleep_hours: numOrNull(f.sleep_hours),
        sleep_quality: numOrNull(f.sleep_quality),
        yesterday_rpe: numOrNull(f.yesterday_rpe),
        partner_available: f.partner,
        court_available: f.court,
        minutes_available: numOrNull(f.minutes),
        journal: f.journal,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save check-in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Daily check-in</h2>
      <p className="mb-4 text-sm text-muted">A few numbers and a note — the coach uses these to adapt.</p>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Resting HR" htmlFor="rhr"><Input id="rhr" type="number" inputMode="numeric" value={f.resting_hr} onChange={(e) => set({ resting_hr: e.target.value })} placeholder="bpm" /></Field>
          <Field label="HRV" htmlFor="hrv"><Input id="hrv" type="number" inputMode="numeric" value={f.hrv} onChange={(e) => set({ hrv: e.target.value })} placeholder="ms" /></Field>
          <Field label="Sleep (h)" htmlFor="sleep"><Input id="sleep" type="number" step="0.5" inputMode="decimal" value={f.sleep_hours} onChange={(e) => set({ sleep_hours: e.target.value })} placeholder="hrs" /></Field>
          <Field label="Sleep quality" htmlFor="sq">
            <Select id="sq" value={f.sleep_quality} onChange={(e) => set({ sleep_quality: e.target.value })}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </Select>
          </Field>
          <Field label="Yesterday RPE" htmlFor="yr"><Input id="yr" type="number" min="1" max="10" inputMode="numeric" value={f.yesterday_rpe} onChange={(e) => set({ yesterday_rpe: e.target.value })} placeholder="1–10" /></Field>
          <Field label="Time today (min)" htmlFor="min"><Input id="min" type="number" inputMode="numeric" value={f.minutes} onChange={(e) => set({ minutes: e.target.value })} placeholder="min" /></Field>
        </div>

        <Field label="Availability today">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant={f.partner ? 'primary' : 'secondary'} onClick={() => set({ partner: !f.partner })}>{f.partner ? 'Partner ✓' : 'No partner'}</Button>
            <Button type="button" variant={f.court ? 'primary' : 'secondary'} onClick={() => set({ court: !f.court })}>{f.court ? 'Court ✓' : 'No court'}</Button>
          </div>
        </Field>

        <Field label="How are you feeling?" hint="Physically and mentally — soreness, energy, motivation, anything going on." htmlFor="journal">
          <Textarea id="journal" value={f.journal} onChange={(e) => set({ journal: e.target.value })} placeholder="e.g. legs a bit heavy but motivated; slept poorly" />
        </Field>

        {error && <p className="text-sm text-red-400">{error}</p>}
        <div><Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Submit check-in'}</Button></div>
      </div>
    </Card>
  )
}
