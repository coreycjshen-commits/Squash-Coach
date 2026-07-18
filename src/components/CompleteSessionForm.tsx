import { useState } from 'react'
import { Button, Card, Input, Field, Textarea } from './ui'

export interface CompletionInput {
  actual_type: string
  actual_duration: number | null
  actual_rpe: number | null
  notes: string
}

export function CompleteSessionForm({
  defaultType, defaultDuration, onSubmit,
}: { defaultType: string; defaultDuration: number | null; onSubmit: (i: CompletionInput) => Promise<void> }) {
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
        actual_type: defaultType,
        actual_duration: duration.trim() === '' ? null : Number(duration),
        actual_rpe: rpe.trim() === '' ? null : Number(rpe),
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
      <h2 className="mb-3 text-lg font-semibold">Log today's session</h2>
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Duration (min)" htmlFor="cd"><Input id="cd" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} /></Field>
          <Field label="Actual RPE" htmlFor="cr"><Input id="cr" type="number" min="1" max="10" value={rpe} onChange={(e) => setRpe(e.target.value)} placeholder="1–10" /></Field>
        </div>
        <Field label="Notes" htmlFor="cn"><Textarea id="cn" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How it went…" /></Field>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <div><Button onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Log as done'}</Button></div>
      </div>
    </Card>
  )
}
