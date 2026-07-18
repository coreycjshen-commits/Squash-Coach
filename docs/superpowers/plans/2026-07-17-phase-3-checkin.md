# Squash Coach — Phase 3: Daily Check-in + Baseline + Solo Swap

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Make the Today screen a real daily loop: enter wearables + a journal note + today's availability, see your recovery vs. your own rolling baseline, get a deterministic solo/ghosting substitution when you have no partner, and log the session as done (seeding load history). The adaptive keep/scale/rest LLM decision is Phase 4.

**Architecture:** Pure, unit-tested math in `src/lib/baseline.ts` (rolling averages, deltas, ACWR) and `src/lib/solo.ts` (infer focus + pick equivalent solo drill). A client data layer `src/lib/checkin.ts` reads recent history, computes the stored deltas/ACWR, and upserts `daily_checkins` + `journal_entries` + `completed_sessions`. The Today page composes small components: `CheckinForm`, `RecoverySnapshot`, `TodaySession` (with solo swap), `CompleteSessionForm`.

**Tech Stack:** Same as prior phases. All DB writes RLS-scoped. No new LLM call this phase.

---

## File Structure (Phase 3)

```
src/
├── lib/
│   ├── baseline.ts        # computeBaseline, computeDeltas, computeACWR (PURE)
│   ├── baseline.test.ts   # TDD
│   ├── solo.ts            # inferFocus, pickSoloDrill (PURE)
│   ├── solo.test.ts       # TDD
│   └── checkin.ts         # client: loadTodayContext, saveCheckin, completeSession
├── components/
│   ├── CheckinForm.tsx
│   ├── RecoverySnapshot.tsx
│   ├── TodaySession.tsx        # today's session + solo swap
│   └── CompleteSessionForm.tsx
└── pages/
    └── Today.tsx          # (rewrite) orchestrates the daily loop
```

---

## Task 1: Baseline & load math (TDD)

**Files:** Create `src/lib/baseline.ts`, `src/lib/baseline.test.ts`

- [ ] **Step 1: Failing test `src/lib/baseline.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { computeBaseline, computeDeltas, computeACWR } from './baseline'

describe('computeBaseline', () => {
  it('averages non-null values to 1dp', () => {
    const b = computeBaseline([
      { hrv: 60, resting_hr: 50, sleep_hours: 8 },
      { hrv: 70, resting_hr: 52, sleep_hours: 7 },
    ])
    expect(b).toEqual({ hrv: 65, resting_hr: 51, sleep_hours: 7.5 })
  })
  it('ignores nulls; returns null for an all-null metric', () => {
    const b = computeBaseline([{ hrv: null, resting_hr: 50, sleep_hours: null }])
    expect(b).toEqual({ hrv: null, resting_hr: 50, sleep_hours: null })
  })
  it('returns all-null for empty history', () => {
    expect(computeBaseline([])).toEqual({ hrv: null, resting_hr: null, sleep_hours: null })
  })
})

describe('computeDeltas', () => {
  it('subtracts baseline from today (today - baseline)', () => {
    const d = computeDeltas(
      { hrv: 55, resting_hr: 54, sleep_hours: 6 },
      { hrv: 65, resting_hr: 51, sleep_hours: 7.5 },
    )
    expect(d).toEqual({ hrv_delta: -10, rhr_delta: 3, sleep_delta: -1.5 })
  })
  it('null when either side missing', () => {
    const d = computeDeltas({ hrv: null, resting_hr: 54, sleep_hours: 6 }, { hrv: 65, resting_hr: null, sleep_hours: 7.5 })
    expect(d).toEqual({ hrv_delta: null, rhr_delta: null, sleep_delta: -1.5 })
  })
})

describe('computeACWR', () => {
  it('null when there is no chronic load', () => {
    expect(computeACWR([], '2026-07-17')).toBeNull()
  })
  it('acute (7d total) over chronic weekly avg (28d/4)', () => {
    // 28 days each with load 100 -> chronic total 2800 -> weekly 700; last 7 days = 700 -> acwr 1.0
    const loads = Array.from({ length: 28 }, (_, i) => ({
      date: new Date(Date.parse('2026-07-17') - i * 86_400_000).toISOString().slice(0, 10),
      load: 100,
    }))
    expect(computeACWR(loads, '2026-07-17')).toBe(1)
  })
  it('flags a spike (acute >> chronic) as >1', () => {
    const loads = [
      ...Array.from({ length: 7 }, (_, i) => ({ date: new Date(Date.parse('2026-07-17') - i * 86_400_000).toISOString().slice(0, 10), load: 300 })),
      ...Array.from({ length: 21 }, (_, i) => ({ date: new Date(Date.parse('2026-07-17') - (i + 7) * 86_400_000).toISOString().slice(0, 10), load: 50 })),
    ]
    const acwr = computeACWR(loads, '2026-07-17')!
    expect(acwr).toBeGreaterThan(1.5)
  })
})
```

- [ ] **Step 2: Run `npx vitest run src/lib/baseline.test.ts` — expect FAIL.**

- [ ] **Step 3: Implement `src/lib/baseline.ts`**

```ts
export interface DailyStat {
  hrv: number | null
  resting_hr: number | null
  sleep_hours: number | null
}
export interface Baseline {
  hrv: number | null
  resting_hr: number | null
  sleep_hours: number | null
}
export interface Deltas {
  hrv_delta: number | null
  rhr_delta: number | null
  sleep_delta: number | null
}
export interface LoadEntry {
  date: string // YYYY-MM-DD
  load: number // duration_min * rpe
}

const round1 = (n: number) => Math.round(n * 10) / 10

function avg(nums: (number | null)[]): number | null {
  const v = nums.filter((n): n is number => n != null)
  if (!v.length) return null
  return round1(v.reduce((a, b) => a + b, 0) / v.length)
}

/** Rolling averages over the supplied recent days (caller passes the trailing window). */
export function computeBaseline(recent: DailyStat[]): Baseline {
  return {
    hrv: avg(recent.map((r) => r.hrv)),
    resting_hr: avg(recent.map((r) => r.resting_hr)),
    sleep_hours: avg(recent.map((r) => r.sleep_hours)),
  }
}

/** today − baseline for each metric; null if either side is missing. */
export function computeDeltas(today: DailyStat, baseline: Baseline): Deltas {
  const d = (t: number | null, b: number | null) => (t != null && b != null ? round1(t - b) : null)
  return {
    hrv_delta: d(today.hrv, baseline.hrv),
    rhr_delta: d(today.resting_hr, baseline.resting_hr),
    sleep_delta: d(today.sleep_hours, baseline.sleep_hours),
  }
}

/**
 * Acute:chronic workload ratio. Acute = total load over the last 7 days;
 * chronic = average weekly load over the last 28 days (28d total / 4).
 * Returns null when there's no chronic load to compare against.
 */
export function computeACWR(loads: LoadEntry[], todayISO: string): number | null {
  const today = Date.parse(todayISO)
  const daysAgo = (d: string) => (today - Date.parse(d)) / 86_400_000
  const inWindow = (d: string, days: number) => {
    const diff = daysAgo(d)
    return diff >= 0 && diff < days
  }
  const acute = loads.filter((l) => inWindow(l.date, 7)).reduce((a, b) => a + b.load, 0)
  const chronicTotal = loads.filter((l) => inWindow(l.date, 28)).reduce((a, b) => a + b.load, 0)
  const chronicWeekly = chronicTotal / 4
  if (chronicWeekly === 0) return null
  return Math.round((acute / chronicWeekly) * 100) / 100
}
```

- [ ] **Step 4: Run test — expect PASS. Commit** — `git add -A && git commit -m "feat: baseline + ACWR math (TDD)"`

---

## Task 2: Solo substitution (TDD)

**Files:** Create `src/lib/solo.ts`, `src/lib/solo.test.ts`

- [ ] **Step 1: Failing test `src/lib/solo.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { inferFocus, pickSoloDrill, type SoloDrill } from './solo'

const drills: SoloDrill[] = [
  { id: 'm1', focus: 'movement', name: '6-Corner Star Ghosting', structure: {}, target_intensity: 8, duration_min: 30, equivalent_for: 'oncourt' },
  { id: 't1', focus: 'touch', name: 'Solo Rail Hitting', structure: {}, target_intensity: 5, duration_min: 30, equivalent_for: 'oncourt' },
  { id: 'f1', focus: 'fitness', name: 'Court Sprint Intervals', structure: {}, target_intensity: 9, duration_min: 25, equivalent_for: 'cardio' },
  { id: 'x1', focus: 'mixed', name: 'Ghost + Hit Pyramid', structure: {}, target_intensity: 7, duration_min: 35, equivalent_for: 'oncourt' },
]

describe('inferFocus', () => {
  it('maps touch-y language to touch', () => {
    expect(inferFocus({ type: 'oncourt', focus: 'Backhand length & drop accuracy', target_rpe: 6, duration_min: 60 })).toBe('touch')
  })
  it('maps movement/ghosting language to movement', () => {
    expect(inferFocus({ type: 'oncourt', focus: 'Ghosting and front-court movement', target_rpe: 7, duration_min: 45 })).toBe('movement')
  })
  it('defaults to mixed when nothing matches', () => {
    expect(inferFocus({ type: 'oncourt', focus: 'General session', target_rpe: 6, duration_min: 60 })).toBe('mixed')
  })
})

describe('pickSoloDrill', () => {
  it('prefers a drill matching the inferred focus, nearest intensity', () => {
    const d = pickSoloDrill({ type: 'oncourt', focus: 'straight-drive length and touch', target_rpe: 5, duration_min: 45 }, drills)
    expect(d?.id).toBe('t1')
  })
  it('picks an oncourt-equivalent movement drill for a ghosting session', () => {
    const d = pickSoloDrill({ type: 'oncourt', focus: 'ghosting movement', target_rpe: 8, duration_min: 40 }, drills)
    expect(d?.id).toBe('m1')
  })
  it('returns null when no drills available', () => {
    expect(pickSoloDrill({ type: 'oncourt', focus: 'x', target_rpe: 6, duration_min: 60 }, [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect FAIL.**

- [ ] **Step 3: Implement `src/lib/solo.ts`**

```ts
export type SoloFocus = 'movement' | 'fitness' | 'touch' | 'mixed'

export interface SoloDrill {
  id: string
  focus: SoloFocus
  name: string
  structure: Record<string, unknown>
  target_intensity: number | null
  duration_min: number | null
  equivalent_for: string
}

export interface PlannedLike {
  type: string
  focus: string | null
  target_rpe: number | null
  duration_min: number | null
}

const KEYWORDS: Record<SoloFocus, string[]> = {
  touch: ['touch', 'drop', 'rail', 'length', 'drive', 'accuracy', 'technical', 'precision', 'kill'],
  movement: ['movement', 'ghost', 'footwork', 'sprint', 'corner', 'front', 'court movement'],
  fitness: ['fitness', 'interval', 'conditioning', 'repeated', 'capacity', 'aerobic', 'cardio'],
  mixed: ['match', 'game', 'pressure', 'condition game', 'strategy'],
}

/** Infer the training focus tag from a planned session's text/type. Defaults to 'mixed'. */
export function inferFocus(session: PlannedLike): SoloFocus {
  const text = `${session.focus ?? ''}`.toLowerCase()
  let best: SoloFocus = 'mixed'
  let bestScore = 0
  for (const f of ['movement', 'fitness', 'touch', 'mixed'] as SoloFocus[]) {
    const score = KEYWORDS[f].reduce((n, k) => n + (text.includes(k) ? 1 : 0), 0)
    if (score > bestScore) {
      best = f
      bestScore = score
    }
  }
  return bestScore > 0 ? best : 'mixed'
}

/**
 * Deterministically pick the solo drill that best replaces this session:
 * same inferred focus if possible, then nearest target intensity, tiebroken by name.
 */
export function pickSoloDrill(session: PlannedLike, drills: SoloDrill[]): SoloDrill | null {
  if (!drills.length) return null
  const focus = inferFocus(session)
  const targetRpe = session.target_rpe ?? 6
  const oncourt = drills.filter((d) => d.equivalent_for === 'oncourt')
  const candidates = oncourt.length ? oncourt : drills
  const matched = candidates.filter((d) => d.focus === focus)
  const pool = matched.length ? matched : candidates
  return [...pool].sort((a, b) => {
    const da = Math.abs((a.target_intensity ?? 6) - targetRpe)
    const db = Math.abs((b.target_intensity ?? 6) - targetRpe)
    return da - db || a.name.localeCompare(b.name)
  })[0]
}
```

- [ ] **Step 4: Run test — expect PASS. Full `npm test` + `npm run build`. Commit** — `git add -A && git commit -m "feat: deterministic solo substitution (TDD)"`

---

## Task 3: Check-in data layer

**Files:** Create `src/lib/checkin.ts`

- [ ] **Step 1: Implement `src/lib/checkin.ts`**

```ts
import { supabase } from './supabase'
import { todayISO } from './dates'
import { startOfWeekISO } from './week'
import {
  computeBaseline, computeDeltas, computeACWR, type Baseline, type Deltas, type LoadEntry,
} from './baseline'
import type { SoloDrill } from './solo'

export interface CheckinRow {
  id: string
  date: string
  resting_hr: number | null
  hrv: number | null
  sleep_hours: number | null
  sleep_quality: number | null
  yesterday_rpe: number | null
  partner_available: boolean | null
  court_available: boolean | null
  minutes_available: number | null
  hrv_delta: number | null
  rhr_delta: number | null
  sleep_delta: number | null
  acwr: number | null
}

export interface TodaySessionRow {
  id: string
  type: 'oncourt' | 'strength' | 'cardio' | 'rest'
  focus: string | null
  duration_min: number | null
  target_rpe: number | null
  detail: Record<string, unknown>
}

export interface CompletionRow {
  id: string
  actual_type: string | null
  actual_duration: number | null
  actual_rpe: number | null
  notes: string | null
}

export interface TodayContext {
  date: string
  checkin: CheckinRow | null
  session: TodaySessionRow | null
  drills: SoloDrill[]
  completion: CompletionRow | null
  recovery: { baseline: Baseline; deltas: Deltas; acwr: number | null } | null
}

export interface CheckinInput {
  resting_hr: number | null
  hrv: number | null
  sleep_hours: number | null
  sleep_quality: number | null
  yesterday_rpe: number | null
  partner_available: boolean
  court_available: boolean
  minutes_available: number | null
  journal: string
}

/** Load everything the Today screen needs. */
export async function loadTodayContext(userId: string): Promise<TodayContext> {
  const date = todayISO()

  const { data: checkin } = await supabase
    .from('daily_checkins').select('*').eq('user_id', userId).eq('date', date).maybeSingle()

  // today's planned session
  const { data: session } = await supabase
    .from('sessions').select('id, type, focus, duration_min, target_rpe, detail')
    .eq('user_id', userId).eq('day', date).order('order_index').limit(1).maybeSingle()

  const { data: drills } = await supabase
    .from('solo_drill_library').select('id, focus, name, structure, target_intensity, duration_min, equivalent_for')

  const { data: completion } = await supabase
    .from('completed_sessions').select('id, actual_type, actual_duration, actual_rpe, notes')
    .eq('user_id', userId).eq('date', date).maybeSingle()

  let recovery: TodayContext['recovery'] = null
  if (checkin) {
    recovery = {
      baseline: { hrv: null, resting_hr: null, sleep_hours: null },
      deltas: { hrv_delta: checkin.hrv_delta, rhr_delta: checkin.rhr_delta, sleep_delta: checkin.sleep_delta },
      acwr: checkin.acwr,
    }
  }

  return {
    date,
    checkin: (checkin as CheckinRow) ?? null,
    session: (session as TodaySessionRow) ?? null,
    drills: (drills as SoloDrill[]) ?? [],
    completion: (completion as CompletionRow) ?? null,
    recovery,
  }
}

/** Save (upsert) today's check-in with computed deltas + ACWR, and the journal entry. */
export async function saveCheckin(userId: string, input: CheckinInput): Promise<void> {
  const date = todayISO()

  // Trailing 7 check-ins BEFORE today for the recovery baseline.
  const { data: recentCheckins } = await supabase
    .from('daily_checkins').select('hrv, resting_hr, sleep_hours, date')
    .eq('user_id', userId).lt('date', date).order('date', { ascending: false }).limit(7)
  const baseline = computeBaseline((recentCheckins ?? []).map((r) => ({ hrv: r.hrv, resting_hr: r.resting_hr, sleep_hours: r.sleep_hours })))
  const deltas = computeDeltas({ hrv: input.hrv, resting_hr: input.resting_hr, sleep_hours: input.sleep_hours }, baseline)

  // 28d completed-session load for ACWR.
  const from = new Date(Date.parse(date) - 28 * 86_400_000).toISOString().slice(0, 10)
  const { data: completed } = await supabase
    .from('completed_sessions').select('date, actual_duration, actual_rpe')
    .eq('user_id', userId).gte('date', from)
  const loads: LoadEntry[] = (completed ?? [])
    .filter((c) => c.actual_duration != null && c.actual_rpe != null)
    .map((c) => ({ date: c.date, load: (c.actual_duration as number) * (c.actual_rpe as number) }))
  const acwr = computeACWR(loads, date)

  const { data: saved, error } = await supabase
    .from('daily_checkins')
    .upsert({
      user_id: userId,
      date,
      resting_hr: input.resting_hr,
      hrv: input.hrv,
      sleep_hours: input.sleep_hours,
      sleep_quality: input.sleep_quality,
      yesterday_rpe: input.yesterday_rpe,
      partner_available: input.partner_available,
      court_available: input.court_available,
      minutes_available: input.minutes_available,
      hrv_delta: deltas.hrv_delta,
      rhr_delta: deltas.rhr_delta,
      sleep_delta: deltas.sleep_delta,
      acwr,
    }, { onConflict: 'user_id,date' })
    .select('id')
    .single()
  if (error) throw error

  if (input.journal.trim()) {
    await supabase.from('journal_entries').insert({
      user_id: userId, date, checkin_id: saved.id, body: input.journal.trim(),
    })
  }
}

/** Log today's session as done (seeds load history + weekly review). */
export async function completeSession(
  userId: string,
  input: { session_id: string | null; actual_type: string; actual_duration: number | null; actual_rpe: number | null; notes: string },
): Promise<void> {
  const date = todayISO()
  // one completion per day: replace any existing
  await supabase.from('completed_sessions').delete().eq('user_id', userId).eq('date', date)
  const { error } = await supabase.from('completed_sessions').insert({
    user_id: userId,
    session_id: input.session_id,
    date,
    actual_type: input.actual_type,
    actual_duration: input.actual_duration,
    actual_rpe: input.actual_rpe,
    notes: input.notes.trim() || null,
  })
  if (error) throw error
}

// re-export for pages
export { startOfWeekISO }
```

- [ ] **Step 2: `npm run build`. Commit** — `git add -A && git commit -m "feat: check-in data layer (baseline persist, journal, completion)"`

---

## Task 4: RecoverySnapshot + TodaySession components

**Files:** Create `src/components/RecoverySnapshot.tsx`, `src/components/TodaySession.tsx`

- [ ] **Step 1: `src/components/RecoverySnapshot.tsx`**

```tsx
import { Card } from './ui'
import type { Deltas } from '../lib/baseline'

function tone(value: number | null, goodIsUp: boolean): string {
  if (value == null) return 'text-muted'
  const good = goodIsUp ? value >= 0 : value <= 0
  return good ? 'text-accent' : 'text-red-400'
}
function fmt(v: number | null, unit = ''): string {
  if (v == null) return '—'
  return `${v > 0 ? '+' : ''}${v}${unit}`
}

export function RecoverySnapshot({ deltas, acwr }: { deltas: Deltas; acwr: number | null }) {
  const acwrTone = acwr == null ? 'text-muted' : acwr > 1.5 || acwr < 0.8 ? 'text-red-400' : 'text-accent'
  return (
    <Card>
      <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted">Recovery vs. your baseline</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="HRV" value={fmt(deltas.hrv_delta, ' ms')} tone={tone(deltas.hrv_delta, true)} />
        <Stat label="Resting HR" value={fmt(deltas.rhr_delta, ' bpm')} tone={tone(deltas.rhr_delta, false)} />
        <Stat label="Sleep" value={fmt(deltas.sleep_delta, ' h')} tone={tone(deltas.sleep_delta, true)} />
        <Stat label="Load ratio" value={acwr == null ? '—' : acwr.toFixed(2)} tone={acwrTone} />
      </div>
      <p className="mt-3 text-xs text-muted">
        Deltas are today vs. your 7-day average. Load ratio (acute:chronic) above ~1.5 means you're ramping up fast.
      </p>
    </Card>
  )
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-lg font-semibold ${tone}`}>{value}</div>
    </div>
  )
}
```

- [ ] **Step 2: `src/components/TodaySession.tsx`**

```tsx
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
```

- [ ] **Step 3: `npm run build`. Commit** — `git add -A && git commit -m "feat: recovery snapshot + today-session (with solo swap) components"`

---

## Task 5: CheckinForm + CompleteSessionForm

**Files:** Create `src/components/CheckinForm.tsx`, `src/components/CompleteSessionForm.tsx`

- [ ] **Step 1: `src/components/CheckinForm.tsx`**

```tsx
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
```

- [ ] **Step 2: `src/components/CompleteSessionForm.tsx`**

```tsx
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
```

- [ ] **Step 3: `npm run build`. Commit** — `git add -A && git commit -m "feat: check-in form + complete-session form"`

---

## Task 6: Today page — orchestrate the daily loop

**Files:** Rewrite `src/pages/Today.tsx`

- [ ] **Step 1: Implement `src/pages/Today.tsx`**

```tsx
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
          onSubmit={async (i) => { await completeSession(uid!, { session_id: ctx.session!.id, ...i }); await refresh() }}
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
```

- [ ] **Step 2: `npm run build` + `npm test` (all suites green). Commit** — `git add -A && git commit -m "feat: Today page — daily check-in loop"`

---

## Task 7 (CHECKPOINT — interactive with Corey): Verify the daily loop

Dev server (`squash-dev`, 5173) serves `/api` + app. No new migration this phase (all tables exist from 0001).

- [ ] **Step 1:** Today tab → the **Daily check-in** form shows. Enter RHR/HRV/sleep/quality/yesterday-RPE, set availability, write a note, Submit.
- [ ] **Step 2:** After submit → **Recovery vs. baseline** snapshot shows (deltas will be "—" on the very first day since there's no prior history; that's expected — do a second day or confirm the row saved with nulls). Confirm the check-in persisted (reload keeps it; Table Editor shows the `daily_checkins` row + a `journal_entries` row).
- [ ] **Step 3:** Toggle **No partner** in the check-in and submit → today's on-court session shows a **solo substitution** card with a matching drill.
- [ ] **Step 4:** **Log today's session** → enter actual RPE/duration/notes → confirms "Logged ✓" and writes `completed_sessions`.
- [ ] **Step 5:** (Optional, to see ACWR/deltas populate) Add a couple of back-dated `daily_checkins`/`completed_sessions` rows in Table Editor, re-open Today → deltas + load ratio show real numbers.
- [ ] **Step 6:** Screenshot the Today loop; share.
- [ ] **Step 7:** Merge `phase-3-checkin` into `main`.

---

## Definition of Done (Phase 3)

- `npm run build` + `npm test` pass (baseline + solo suites added, all prior green).
- Today shows a daily check-in (wearables + availability + journal); submitting computes & stores deltas vs the 7-day baseline + ACWR, saves the journal entry.
- Recovery snapshot renders deltas + load ratio with sensible good/bad coloring.
- No-partner on an on-court day deterministically swaps in a matched solo drill from the library.
- Session completion logs `completed_sessions` (seeding load history for ACWR + Phase 5 review).
- No LLM call added this phase (adaptive decision is Phase 4).
