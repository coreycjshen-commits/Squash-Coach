import { useState } from 'react'
import { Button, Card, Input, Field, Textarea, Select } from './ui'

export interface CompletionInput {
  actual_type: string
  actual_duration: number | null
  actual_rpe: number | null
  adjustment: string | null
  notes: string
}

const TYPES = [
  { value: 'oncourt', label: 'On-court' },
  { value: 'strength', label: 'Strength' },
  { value: 'cardio', label: 'Cardio' },
  { value: 'rest', label: 'Rest' },
]

export function CompleteSessionForm({
  defaultType, defaultDuration, plannedType, onSubmit,
}: { defaultType: string; defaultDuration: number | null; plannedType: string; onSubmit: (i: CompletionInput) => Promise<void> }) {
  const [type, setType] = useState(defaultType)
  const [duration, setDuration] = useState(defaultDuration != null ? String(defaultDuration) : '')
  const [rpe, setRpe] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    setBusy(true)
    setError(null)
    try {
      await onSubmit({
        actual_type: type,
        actual_duration: duration.trim() === '' ? null : Number(duration),
        actual_rpe: rpe.trim() === '' ? null : Number(rpe),
        adjustment: type !== plannedType ? 'change_modality' : 'keep',
        notes,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not log session')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card>
      <h2 className="mb-1 text-lg font-semibold">Log today's session</h2>
      <p className="mb-3 text-sm text-muted">Did something different? Change the type — log what you actually did.</p>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="What you did" htmlFor="ct">
            <Select id="ct" value={type} onChange={(e) => setType(e.target.value)}>
              {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="Duration (min)" htmlFor="cd"><Input id="cd" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
          <Field label="Actual RPE" htmlFor="cr"><Input id="cr" type="number" min="1" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder="1–10" /></Field>
        </div>
        <Field label="Notes" htmlFor="cn"><Textarea id="cn" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. skipped the lift, played 45 min of matches instead" /></Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div><Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Log as done'}</Button></div>
      </div>
    </Card>
  )
}
