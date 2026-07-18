# Squash Coach — Phase 4: Adaptive Daily Decision + Today↔Week Sync

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** After the daily check-in, decide — via hard-coded guardrails first, then an LLM reading your recovery + journal + availability — whether today's session stays, scales, changes modality, or becomes rest, with a visible rationale. Show the adapted session on Today, reflect status back on Week, and let you log what you actually did even if it's off-plan.

**Architecture:** Pure `guardrails.ts` (force-rest triggers) runs BEFORE any LLM call. `decisionSchema.ts` (Zod) defines the decision contract. `/api/checkin` runs guardrails → LLM (`buildCheckinMessages`) → Zod-validate → fallback-to-keep, persists the decision onto the `daily_checkins` row (migration 0003) and logs it. Today shows a `DecisionCard` + the session to actually do; Week annotates each day with its live status (adapted / done + actual RPE). Completion logging gains type/adjustment fields for off-plan sessions.

**Tech Stack:** Same. Third structured LLM call (`/api/checkin`). No new dependencies.

---

## File Structure (Phase 4)

```
supabase/migrations/0003_daily_decision.sql   # decision cols on daily_checkins
src/lib/
├── guardrails.ts        # checkGuardrails (PURE) + test
├── decisionSchema.ts    # DecisionSchema/AdjustedSession (Zod) + test
├── checkin.ts           # (modify) requestDecision(); decision fields in context; off-plan completeSession
└── week.ts              # (unchanged)
src/lib/weekStatus.ts    # (new) load per-day status for Week
api/_lib/prompt.ts       # (modify) buildCheckinMessages
api/checkin.ts           # (new) adaptive endpoint (guardrails + LLM + persist + log)
src/components/
├── DecisionCard.tsx     # (new) decision + rationale + adapted session
├── CompleteSessionForm.tsx  # (modify) type selector for off-plan logging
└── TodaySession.tsx     # (unchanged; reused for planned/adjusted)
src/pages/
├── Today.tsx            # (modify) run decision after check-in; show DecisionCard
└── Week.tsx             # (modify) show live per-day status
```

---

## Task 1 (CHECKPOINT — interactive): Migration 0003

**Files:** Create `supabase/migrations/0003_daily_decision.sql`

- [ ] **Step 1:**
```sql
alter table daily_checkins
  add column if not exists decision text,
  add column if not exists decision_rationale text,
  add column if not exists adjusted_session jsonb,
  add column if not exists decision_source text;
```
- [ ] **Step 2:** Corey runs it in Supabase SQL Editor; confirm the 4 columns exist on `daily_checkins`.
- [ ] **Step 3: Commit** — `git add -A && git commit -m "feat: migration 0003 — daily decision columns"`

---

## Task 2: Guardrails (TDD)

**Files:** Create `src/lib/guardrails.ts`, `src/lib/guardrails.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { checkGuardrails } from './guardrails'

describe('checkGuardrails', () => {
  it('forces rest when the journal mentions pain/injury', () => {
    const r = checkGuardrails({ journal: 'sharp pain in my right knee today', sleep_hours: 8, rhr_delta: 0, hrv_delta: 0 })
    expect(r.forceRest).toBe(true)
    expect(r.reasons.join(' ')).toMatch(/pain|injur/i)
  })
  it('does NOT trigger on negated pain ("no pain")', () => {
    expect(checkGuardrails({ journal: 'legs sore but no pain, feeling good', sleep_hours: 8, rhr_delta: 0, hrv_delta: 0 }).forceRest).toBe(false)
  })
  it('forces rest on severe sleep loss (<4h)', () => {
    expect(checkGuardrails({ journal: 'ok', sleep_hours: 3.5, rhr_delta: 0, hrv_delta: 0 }).forceRest).toBe(true)
  })
  it('forces rest when resting HR is far above baseline (+10)', () => {
    expect(checkGuardrails({ journal: 'ok', sleep_hours: 7, rhr_delta: 12, hrv_delta: 0 }).forceRest).toBe(true)
  })
  it('forces rest when HRV is far below baseline (-15)', () => {
    expect(checkGuardrails({ journal: 'ok', sleep_hours: 7, rhr_delta: 0, hrv_delta: -20 }).forceRest).toBe(true)
  })
  it('passes a normal check-in through', () => {
    const r = checkGuardrails({ journal: 'felt good, bit tired', sleep_hours: 7, rhr_delta: 2, hrv_delta: -3 })
    expect(r.forceRest).toBe(false)
    expect(r.reasons).toEqual([])
  })
  it('tolerates null wearables (only journal applies)', () => {
    expect(checkGuardrails({ journal: 'all good', sleep_hours: null, rhr_delta: null, hrv_delta: null }).forceRest).toBe(false)
  })
})
```

- [ ] **Step 2: Run — FAIL. Step 3: Implement `src/lib/guardrails.ts`**

```ts
export interface GuardrailInput {
  journal: string
  sleep_hours: number | null
  rhr_delta: number | null // today − 7d baseline (bpm)
  hrv_delta: number | null // today − 7d baseline (ms)
}
export interface GuardrailResult {
  forceRest: boolean
  reasons: string[]
}

// Thresholds are deliberately conservative — guardrails only fire on clearly bad signals;
// nuanced interpretation is the LLM's job.
const SLEEP_FLOOR_H = 4
const RHR_SPIKE_BPM = 10
const HRV_DROP_MS = -15

const PAIN = /\b(pain|sharp|tweak(ed)?|strain(ed)?|pulled|injur(y|ed|ies)|sprain(ed)?|swollen|hurts?)\b/i
const NEGATED_PAIN = /\b(no|without|zero)\s+pain\b|pain[-\s]?free|painless|no\s+injur/i

export function checkGuardrails(i: GuardrailInput): GuardrailResult {
  const reasons: string[] = []
  if (PAIN.test(i.journal) && !NEGATED_PAIN.test(i.journal)) reasons.push('journal mentions pain/injury')
  if (i.sleep_hours != null && i.sleep_hours < SLEEP_FLOOR_H) reasons.push(`severe sleep loss (${i.sleep_hours}h)`)
  if (i.rhr_delta != null && i.rhr_delta >= RHR_SPIKE_BPM) reasons.push(`resting HR ${i.rhr_delta} bpm above baseline`)
  if (i.hrv_delta != null && i.hrv_delta <= HRV_DROP_MS) reasons.push(`HRV ${i.hrv_delta} ms below baseline`)
  return { forceRest: reasons.length > 0, reasons }
}
```

- [ ] **Step 4: Run — PASS. Commit** — `git add -A && git commit -m "feat: check-in guardrails (TDD)"`

---

## Task 3: Decision schema (TDD)

**Files:** Create `src/lib/decisionSchema.ts`, `src/lib/decisionSchema.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { DecisionSchema } from './decisionSchema'

const base = { decision: 'keep', rationale: 'Recovery is solid; run it as planned.' }

describe('DecisionSchema', () => {
  it('accepts a keep decision with no adjusted session', () => {
    expect(DecisionSchema.safeParse(base).success).toBe(true)
  })
  it('accepts a change with an adjusted session', () => {
    const r = DecisionSchema.safeParse({
      decision: 'change_modality', rationale: 'Sore legs — swap the lift for mobility + touch.',
      adjusted_session: { type: 'oncourt', focus: 'Light touch & feel', duration_min: 40, target_rpe: 4, detail: { drills: ['soft drops 3 × 5 min'] } },
    })
    expect(r.success).toBe(true)
  })
  it('rejects an unknown decision', () => {
    expect(DecisionSchema.safeParse({ ...base, decision: 'yolo' }).success).toBe(false)
  })
  it('rejects an empty rationale', () => {
    expect(DecisionSchema.safeParse({ decision: 'rest', rationale: '' }).success).toBe(false)
  })
  it('rejects an adjusted session with a bad RPE', () => {
    expect(DecisionSchema.safeParse({ ...base, decision: 'scale_down', adjusted_session: { type: 'oncourt', focus: 'x', duration_min: 40, target_rpe: 99, detail: {} } }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run — FAIL. Step 3: Implement `src/lib/decisionSchema.ts`**

```ts
import { z } from 'zod'
import { SESSION_TYPES } from './planSchema'

export const DECISIONS = ['keep', 'scale_down', 'scale_up', 'change_modality', 'rest'] as const

export const AdjustedSessionSchema = z.object({
  type: z.enum(SESSION_TYPES),
  focus: z.string().min(1),
  duration_min: z.number().int().min(0).max(300),
  target_rpe: z.number().int().min(1).max(10),
  detail: z.record(z.string(), z.unknown()).default({}),
})
export type AdjustedSession = z.infer<typeof AdjustedSessionSchema>

export const DecisionSchema = z.object({
  decision: z.enum(DECISIONS),
  rationale: z.string().min(1),
  adjusted_session: AdjustedSessionSchema.nullable().optional(),
})
export type Decision = z.infer<typeof DecisionSchema>
```

- [ ] **Step 4: Run — PASS. Full `npm test` + `npm run build`. Commit** — `git add -A && git commit -m "feat: daily decision schema (TDD)"`

---

## Task 4: Daily-interpretation prompt

**Files:** Modify `api/_lib/prompt.ts`

- [ ] **Step 1:** Append to `api/_lib/prompt.ts`:

```ts
export interface CheckinPromptInput {
  profile: WeeklyPromptInput['profile']
  phase: string
  plannedSession: { type: string; focus: string | null; duration_min: number | null; target_rpe: number | null } | null
  deltas: { hrv_delta: number | null; rhr_delta: number | null; sleep_delta: number | null }
  sleep_hours: number | null
  yesterday_rpe: number | null
  partner_available: boolean
  court_available: boolean
  minutes_available: number | null
  journal: string
}

const CHECKIN_SYSTEM = `You are a squash coach interpreting an athlete's morning check-in to decide how to run TODAY's
planned session. Weigh recovery signals against your own athlete's baseline (deltas are today − their 7-day average):
- HRV notably below baseline, resting HR above baseline, poor/short sleep, high soreness, or a fatigued/low journal
  tone → scale down or change to something lighter.
- Clearly fresh and recovering well → keep, or scale up slightly if the plan was conservative.
- Signals stacking up (poor sleep + elevated RHR + depressed/exhausted tone) → recommend REST and say why.
- If no partner/court but the plan needs them, change modality to an equivalent solo/ghosting/fitness session.
- If they have far less time than the session needs, scale the session to fit.
Be decisive and specific, and keep the athlete's goal/phase in mind. Protect them from ramping too fast after a light patch.

Return STRICT JSON ONLY:
{"decision":"keep"|"scale_down"|"scale_up"|"change_modality"|"rest","rationale": string (1-2 sentences, plain and specific),
"adjusted_session": null | {"type":"oncourt"|"strength"|"cardio"|"rest","focus":string,"duration_min":int,"target_rpe":int 1-10,"detail":object}}
Set "adjusted_session" to null ONLY when decision is "keep". For every other decision, provide the concrete adjusted
session with the SAME trainer-level specificity as a normal plan (named drills, sets × time, intervals, loads).`

export function buildCheckinMessages(input: CheckinPromptInput): ChatMessage[] {
  const p = input.profile
  const s = input.plannedSession
  const user = `ATHLETE: ${p.playstyle ?? 'unspecified'} player, level ${p.us_squash_rating != null ? `US Squash ${p.us_squash_rating}` : p.level_descriptor ?? 'unspecified'}; goal ${p.goal_type ?? 'general'}; phase ${input.phase}; injuries: ${p.injuries.length ? p.injuries.join('; ') : 'none'}.

TODAY'S PLANNED SESSION: ${s ? `${s.type} — ${s.focus ?? ''} (${s.duration_min ?? '?'} min, RPE ${s.target_rpe ?? '?'})` : 'none planned'}

CHECK-IN vs BASELINE (today − 7-day avg):
- HRV delta: ${fmtDelta(input.deltas.hrv_delta, 'ms')}
- Resting HR delta: ${fmtDelta(input.deltas.rhr_delta, 'bpm')}
- Sleep delta: ${fmtDelta(input.deltas.sleep_delta, 'h')} (slept ${input.sleep_hours ?? '?'}h)
- Yesterday's session RPE: ${input.yesterday_rpe ?? 'n/a'}

TODAY'S AVAILABILITY: partner ${input.partner_available ? 'yes' : 'no'}, court ${input.court_available ? 'yes' : 'no'}, time ${input.minutes_available ?? '?'} min.

JOURNAL: ${input.journal || '(none)'}

Decide how to run today. Return the JSON.`
  return [
    { role: 'system', content: CHECKIN_SYSTEM },
    { role: 'user', content: user },
  ]
}

function fmtDelta(v: number | null, unit: string): string {
  if (v == null) return 'n/a (no baseline yet)'
  return `${v > 0 ? '+' : ''}${v} ${unit}`
}
```

- [ ] **Step 2:** `npm run build` + api typecheck (`npx tsc --ignoreConfig --noEmit --strict --skipLibCheck --module esnext --moduleResolution bundler --target es2022 --esModuleInterop api/*.ts api/_lib/*.ts`). Commit — `git add -A && git commit -m "feat: daily check-in interpretation prompt"`

---

## Task 5: /api/checkin endpoint

**Files:** Create `api/checkin.ts`

- [ ] **Step 1:**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clientFromRequest } from './_lib/supabaseServer'
import { callGroqJSON } from './_lib/groq'
import { buildCheckinMessages } from './_lib/prompt'
import { checkGuardrails } from '../src/lib/guardrails'
import { DecisionSchema, type Decision } from '../src/lib/decisionSchema'
import { currentPhase, type Macrocycle } from '../src/lib/macrocycle'
import { startOfWeekISO } from '../src/lib/week'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const supabase = clientFromRequest(req.headers.authorization)
  if (!supabase) return res.status(401).json({ error: 'Missing bearer token' })
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) return res.status(401).json({ error: 'Invalid session' })
  const userId = userData.user.id

  const date = typeof req.body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)
    ? req.body.date : new Date().toISOString().slice(0, 10)

  const { data: checkin } = await supabase
    .from('daily_checkins').select('*').eq('user_id', userId).eq('date', date).maybeSingle()
  if (!checkin) return res.status(400).json({ error: 'No check-in for today yet' })

  const { data: journalRow } = await supabase
    .from('journal_entries').select('body').eq('user_id', userId).eq('date', date)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  const journal = journalRow?.body ?? ''

  const { data: session } = await supabase
    .from('sessions').select('type, focus, duration_min, target_rpe')
    .eq('user_id', userId).eq('day', date).order('order_index').limit(1).maybeSingle()

  // 1) GUARDRAILS FIRST — before any LLM call.
  const guard = checkGuardrails({
    journal, sleep_hours: checkin.sleep_hours, rhr_delta: checkin.rhr_delta, hrv_delta: checkin.hrv_delta,
  })

  let decision: Decision
  let source: 'guardrail' | 'llm' | 'fallback'
  let raw: string | null = null

  if (guard.forceRest) {
    decision = { decision: 'rest', rationale: `Recommending rest: ${guard.reasons.join('; ')}. Recover today — pushing through these signals risks injury or a deeper dip.`, adjusted_session: { type: 'rest', focus: 'Full recovery', duration_min: 0, target_rpe: 1, detail: { notes: 'Sleep, hydrate, light mobility only.' } } }
    source = 'guardrail'
  } else {
    const { data: macroRow } = await supabase
      .from('macrocycles').select('start_date, end_date, block_type, phases')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    const phase = macroRow ? currentPhase(macroRow as Macrocycle, startOfWeekISO(date)).name : 'General Prep'

    const { data: profile } = await supabase
      .from('profiles')
      .select('playstyle, us_squash_rating, level_descriptor, days_per_week, avg_session_min, has_partner_default, gym_access, goal_type, injuries, focus_areas, recent_context, season_status')
      .eq('id', userId).single()

    try {
      const messages = buildCheckinMessages({
        profile: { ...profile!, injuries: (profile!.injuries as string[]) ?? [], focus_areas: (profile!.focus_areas as string[]) ?? [] },
        phase,
        plannedSession: session ?? null,
        deltas: { hrv_delta: checkin.hrv_delta, rhr_delta: checkin.rhr_delta, sleep_delta: checkin.sleep_delta },
        sleep_hours: checkin.sleep_hours,
        yesterday_rpe: checkin.yesterday_rpe,
        partner_available: checkin.partner_available ?? true,
        court_available: checkin.court_available ?? true,
        minutes_available: checkin.minutes_available,
        journal,
      })
      const json = await callGroqJSON(messages)
      raw = JSON.stringify(json)
      decision = DecisionSchema.parse(json)
      source = 'llm'
    } catch (e) {
      raw = e instanceof Error ? e.message : String(e)
      decision = { decision: 'keep', rationale: 'Keeping today as planned (the coach model was unavailable to adjust).', adjusted_session: null }
      source = 'fallback'
    }
  }

  await supabase.from('daily_checkins').update({
    decision: decision.decision,
    decision_rationale: decision.rationale,
    adjusted_session: decision.adjusted_session ?? null,
    decision_source: source,
  }).eq('id', checkin.id)

  await supabase.from('llm_logs').insert({
    user_id: userId, call_type: 'daily',
    input_summary: { date, guardrail: guard.forceRest, reasons: guard.reasons },
    raw_response: raw, parsed: decision, status: source === 'llm' ? 'ok' : source === 'fallback' ? 'fallback' : 'ok',
  })

  return res.status(200).json({ ...decision, source })
}
```

- [ ] **Step 2:** `npm run build` + api typecheck. Commit — `git add -A && git commit -m "feat: /api/checkin adaptive decision (guardrails + LLM + persist + log)"`

---

## Task 6: Client — requestDecision, decision in context, off-plan completion

**Files:** Modify `src/lib/checkin.ts`

- [ ] **Step 1:** Add decision fields to `CheckinRow`:
```ts
  acwr: number | null
  decision: string | null
  decision_rationale: string | null
  adjusted_session: Record<string, unknown> | null
  decision_source: string | null
```
(`select('*')` already returns them.)

- [ ] **Step 2:** Add a `requestDecision` function:
```ts
export async function requestDecision(): Promise<{ ok: boolean; error?: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { ok: false, error: 'Not signed in' }
  const res = await fetch('/api/checkin', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ date: todayISO() }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: body.error ?? `Server error ${res.status}` }
  return { ok: true }
}
```

- [ ] **Step 3:** Extend `completeSession` to accept `actual_type` (already does) plus an `adjustment` label and keep notes. Change its signature/body to:
```ts
export async function completeSession(
  userId: string,
  input: { session_id: string | null; actual_type: string; actual_duration: number | null; actual_rpe: number | null; adjustment: string | null; notes: string },
): Promise<void> {
  const date = todayISO()
  await supabase.from('completed_sessions').delete().eq('user_id', userId).eq('date', date)
  const { error } = await supabase.from('completed_sessions').insert({
    user_id: userId, session_id: input.session_id, date,
    actual_type: input.actual_type, actual_duration: input.actual_duration, actual_rpe: input.actual_rpe,
    adjustment: input.adjustment, notes: input.notes.trim() || null,
  })
  if (error) throw error
}
```

- [ ] **Step 4:** `npm run build`. Commit — `git add -A && git commit -m "feat: client requestDecision + decision context + off-plan completion"`

---

## Task 7: DecisionCard + off-plan CompleteSessionForm

**Files:** Create `src/components/DecisionCard.tsx`; modify `src/components/CompleteSessionForm.tsx`

- [ ] **Step 1:** `src/components/DecisionCard.tsx`:

```tsx
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
```

- [ ] **Step 2:** Modify `CompleteSessionForm.tsx` — add a type selector so off-plan sessions can be logged. Update `CompletionInput` and the form:

```tsx
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
```

- [ ] **Step 3:** `npm run build`. Commit — `git add -A && git commit -m "feat: decision card + off-plan completion form"`

---

## Task 8: Today wires the decision

**Files:** Modify `src/pages/Today.tsx`

- [ ] **Step 1:** Import `requestDecision`, `DecisionCard`. After the check-in form submits, run the decision, then refresh:

Replace the CheckinForm usage:
```tsx
      {!ctx.checkin && (
        <CheckinForm onSubmit={async (input) => {
          await saveCheckin(uid!, input)
          await requestDecision()
          await refresh()
        }} />
      )}
```

- [ ] **Step 2:** After the RecoverySnapshot, render the DecisionCard when a decision exists:
```tsx
      {ctx.checkin?.decision && (
        <DecisionCard
          decision={ctx.checkin.decision}
          rationale={ctx.checkin.decision_rationale ?? ''}
          adjusted={ctx.checkin.adjusted_session as never}
        />
      )}
```

- [ ] **Step 3:** Show the session to actually do — prefer the adjusted session, else planned (TodaySession with solo swap). Replace the session block:
```tsx
      {ctx.checkin?.decision === 'rest'
        ? null /* rest is fully conveyed by the DecisionCard */
        : ctx.session
          ? <TodaySession session={ctx.session} noPartner={noPartner} drills={ctx.drills} />
          : (
            <Card>
              <p className="text-muted">No session planned for today.</p>
              <Link to="/week" className="mt-2 inline-block text-sm text-accent">Generate this week's plan →</Link>
            </Card>
          )}
```
(The adjusted session already shows inside DecisionCard; TodaySession remains for keep/no-decision and still applies the no-partner solo swap.)

- [ ] **Step 4:** Update the CompleteSessionForm call to pass `plannedType` and the new adjustment field:
```tsx
      {ctx.checkin && (ctx.session || ctx.checkin.decision) && !ctx.completion && (
        <CompleteSessionForm
          defaultType={(ctx.checkin.adjusted_session as { type?: string } | null)?.type ?? ctx.session?.type ?? 'oncourt'}
          defaultDuration={ctx.session?.duration_min ?? null}
          plannedType={ctx.session?.type ?? 'oncourt'}
          onSubmit={async (i) => { await completeSession(uid!, { session_id: ctx.session?.id ?? null, ...i }); await refresh() }}
        />
      )}
```

- [ ] **Step 5:** `npm run build` + `npm test`. Commit — `git add -A && git commit -m "feat: Today runs adaptive decision + shows decision card"`

---

## Task 9: Week live status

**Files:** Create `src/lib/weekStatus.ts`; modify `src/pages/Week.tsx`

- [ ] **Step 1:** `src/lib/weekStatus.ts`:

```ts
import { supabase } from './supabase'

export interface DayStatus {
  decision: string | null
  completed: boolean
  actual_rpe: number | null
  actual_type: string | null
}

/** Map date -> status for a week window, from daily_checkins (decision) + completed_sessions. */
export async function loadWeekStatus(userId: string, weekStart: string): Promise<Record<string, DayStatus>> {
  const end = new Date(Date.parse(weekStart) + 7 * 86_400_000).toISOString().slice(0, 10)
  const [{ data: checkins }, { data: done }] = await Promise.all([
    supabase.from('daily_checkins').select('date, decision').eq('user_id', userId).gte('date', weekStart).lt('date', end),
    supabase.from('completed_sessions').select('date, actual_rpe, actual_type').eq('user_id', userId).gte('date', weekStart).lt('date', end),
  ])
  const map: Record<string, DayStatus> = {}
  for (const c of checkins ?? []) map[c.date] = { decision: c.decision, completed: false, actual_rpe: null, actual_type: null }
  for (const d of done ?? []) {
    map[d.date] = { ...(map[d.date] ?? { decision: null }), completed: true, actual_rpe: d.actual_rpe, actual_type: d.actual_type }
  }
  return map
}
```

- [ ] **Step 2:** In `Week.tsx`, load statuses and show a badge per session. Add near the top of the component:
```tsx
import { loadWeekStatus, type DayStatus } from '../lib/weekStatus'
```
Add state + load in the existing refresh (after loading the plan):
```tsx
  const [status, setStatus] = useState<Record<string, DayStatus>>({})
```
In `refresh`, after `setPlan(...)`:
```tsx
    const p = await loadCurrentWeek(uid)
    setPlan(p)
    if (p) setStatus(await loadWeekStatus(uid, p.week_start))
```
(Adjust to store the plan in a local var; keep existing behavior otherwise.)

- [ ] **Step 3:** In each session card header, render a status badge from `status[s.day]`:
```tsx
              {(() => {
                const st = status[s.day]
                if (!st) return null
                if (st.completed) return <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">Done{st.actual_rpe ? ` · RPE ${st.actual_rpe}` : ''}</span>
                if (st.decision && st.decision !== 'keep') return <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-muted">Adapted → {st.decision.replace('_', ' ')}</span>
                return null
              })()}
```
Place it next to the day/type line (wrap that line + badge in a flex row).

- [ ] **Step 4:** `npm run build` + `npm test`. Commit — `git add -A && git commit -m "feat: Week shows live per-day status (done / adapted)"`

---

## Task 10 (CHECKPOINT — interactive with Corey): Verify

Dev server serves `/api`. Corey signed in.

- [ ] **Step 1:** Migration 0003 applied (Task 1).
- [ ] **Step 2:** Today → submit a check-in with GOOD numbers + upbeat note → DecisionCard shows "Keep as planned" (or scale up) with a rationale; the planned session shows.
- [ ] **Step 3:** Re-submit (or new day) with BAD signals — e.g. journal "sharp pain in knee" → guardrail forces **Rest** with the reason. Then a non-injury fatigue case (poor sleep + tired tone) → LLM **scale down / change** with a concrete lighter adjusted session.
- [ ] **Step 4:** "No partner" → the adjusted/planned on-court still solo-swaps.
- [ ] **Step 5:** Log an OFF-PLAN session (change the type, add a note) → saved.
- [ ] **Step 6:** Week → the day shows **Done · RPE X** (or **Adapted → …**). Confirm Today and Week agree.
- [ ] **Step 7:** Check `llm_logs` has a `daily` row; screenshot the DecisionCard + Week status; share.
- [ ] **Step 8:** Merge `phase-4-adaptive` into `main`.

---

## Definition of Done (Phase 4)

- `npm run build` + `npm test` pass (guardrails + decision-schema suites added).
- Guardrails run server-side BEFORE the LLM and force rest on pain/injury journal or extreme wearable outliers.
- `/api/checkin` returns a validated decision (keep/scale_down/scale_up/change_modality/rest) + rationale, with a concrete adjusted session for non-keep; falls back to keep on LLM failure; persists to `daily_checkins` and logs to `llm_logs`.
- Today shows the decision + what to actually do; Week reflects each day's live status; the two agree.
- Off-plan training can be logged (type changed + note), feeding load history + review.
