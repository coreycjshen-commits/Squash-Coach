# Squash Coach — Phase 5: Progress Dashboard + Searchable Journal

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Close the loop with review: a Progress page (completed-vs-planned, adherence, RPE trend, adjustments + reasons) and a searchable training Journal, and re-add both to the nav. No new LLM calls or migrations.

**Architecture:** A pure, tested `summarizeWeek()` aggregates planned sessions + completions + daily decisions into a week summary. Client loaders read the data (RLS-scoped). Progress composes a `WeeklySummary` + a lightweight CSS `RpeTrend` (no chart lib). Journal lists `journal_entries` with an `ilike` search box.

**Tech Stack:** Same. Frontend + client data only (all imports extensionless — fine for the Vite frontend; only `/api/*` needs `.js` extensions on Vercel, and no API changes here).

---

## File Structure (Phase 5)

```
src/lib/
├── progressStats.ts       # summarizeWeek() (PURE) + test
├── progress.ts            # client: loadWeekProgress, loadRpeSeries
└── journal.ts             # client: loadJournal(userId, query?)
src/components/
├── WeeklySummary.tsx      # planned/completed/adherence/adjustments/byType
└── RpeTrend.tsx           # CSS bar chart of recent actual RPE
src/pages/
├── Progress.tsx           # (rewrite) compose summary + trend
└── Journal.tsx            # (rewrite) searchable diary
src/components/AppShell.tsx # (modify) nav += Journal, Progress
```

---

## Task 1: Week-summary aggregation (TDD)

**Files:** Create `src/lib/progressStats.ts`, `src/lib/progressStats.test.ts`

- [ ] **Step 1: Failing test**

```ts
import { describe, it, expect } from 'vitest'
import { summarizeWeek } from './progressStats'

describe('summarizeWeek', () => {
  it('computes adherence, avg RPE, adjustments, and by-type counts', () => {
    const s = summarizeWeek({
      plannedCount: 5,
      completions: [
        { actual_rpe: 7, actual_type: 'oncourt' },
        { actual_rpe: 6, actual_type: 'strength' },
        { actual_rpe: null, actual_type: 'oncourt' },
      ],
      decisions: [
        { date: '2026-07-13', decision: 'keep' },
        { date: '2026-07-14', decision: 'scale_down' },
        { date: '2026-07-15', decision: 'rest' },
      ],
    })
    expect(s.planned).toBe(5)
    expect(s.completed).toBe(3)
    expect(s.adherencePct).toBe(60) // 3/5
    expect(s.avgActualRpe).toBe(6.5) // (7+6)/2, nulls ignored
    expect(s.adjustments).toEqual([
      { date: '2026-07-14', decision: 'scale_down' },
      { date: '2026-07-15', decision: 'rest' },
    ])
    expect(s.byType).toEqual({ oncourt: 2, strength: 1 })
  })
  it('handles an empty week without dividing by zero', () => {
    const s = summarizeWeek({ plannedCount: 0, completions: [], decisions: [] })
    expect(s).toEqual({ planned: 0, completed: 0, adherencePct: 0, avgActualRpe: null, adjustments: [], byType: {} })
  })
})
```

- [ ] **Step 2: Run — FAIL. Step 3: Implement `src/lib/progressStats.ts`**

```ts
export interface WeekProgressInput {
  plannedCount: number
  completions: { actual_rpe: number | null; actual_type: string | null }[]
  decisions: { date: string; decision: string | null }[]
}
export interface WeekProgress {
  planned: number
  completed: number
  adherencePct: number
  avgActualRpe: number | null
  adjustments: { date: string; decision: string }[]
  byType: Record<string, number>
}

export function summarizeWeek(i: WeekProgressInput): WeekProgress {
  const completed = i.completions.length
  const adherencePct = i.plannedCount > 0 ? Math.round((completed / i.plannedCount) * 100) : 0
  const rpes = i.completions.map((c) => c.actual_rpe).filter((n): n is number => n != null)
  const avgActualRpe = rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null
  const adjustments = i.decisions
    .filter((d) => d.decision && d.decision !== 'keep')
    .map((d) => ({ date: d.date, decision: d.decision as string }))
  const byType: Record<string, number> = {}
  for (const c of i.completions) {
    const t = c.actual_type ?? 'other'
    byType[t] = (byType[t] ?? 0) + 1
  }
  return { planned: i.plannedCount, completed, adherencePct, avgActualRpe, adjustments, byType }
}
```

- [ ] **Step 4: Run — PASS. Full `npm test` + `npm run build`. Commit** — `git add -A && git commit -m "feat: week-summary aggregation (TDD)"`

---

## Task 2: Client loaders (progress + journal)

**Files:** Create `src/lib/progress.ts`, `src/lib/journal.ts`

- [ ] **Step 1: `src/lib/progress.ts`**

```ts
import { supabase } from './supabase'
import { startOfWeekISO } from './week'
import { todayISO, addWeeks } from './dates'
import { summarizeWeek, type WeekProgress } from './progressStats'

export interface RpePoint { date: string; rpe: number; type: string | null }

/** Aggregate this week's planned vs completed + adjustments. */
export async function loadWeekProgress(userId: string): Promise<{ weekStart: string; summary: WeekProgress }> {
  const weekStart = startOfWeekISO(todayISO())
  const end = addWeeks(weekStart, 1)

  const { data: plan } = await supabase
    .from('weekly_plans').select('id').eq('user_id', userId).eq('week_start', weekStart).maybeSingle()
  let plannedCount = 0
  if (plan) {
    const { count } = await supabase
      .from('sessions').select('id', { count: 'exact', head: true }).eq('weekly_plan_id', plan.id).neq('type', 'rest')
    plannedCount = count ?? 0
  }

  const { data: completions } = await supabase
    .from('completed_sessions').select('actual_rpe, actual_type')
    .eq('user_id', userId).gte('date', weekStart).lt('date', end)

  const { data: decisions } = await supabase
    .from('daily_checkins').select('date, decision')
    .eq('user_id', userId).gte('date', weekStart).lt('date', end).order('date')

  const summary = summarizeWeek({
    plannedCount,
    completions: (completions ?? []).map((c) => ({ actual_rpe: c.actual_rpe, actual_type: c.actual_type })),
    decisions: (decisions ?? []).map((d) => ({ date: d.date, decision: d.decision })),
  })
  return { weekStart, summary }
}

/** Trailing series of actual RPE from logged sessions (most recent last). */
export async function loadRpeSeries(userId: string, days = 21): Promise<RpePoint[]> {
  const fromDate = new Date(Date.parse(todayISO()) - days * 86_400_000).toISOString().slice(0, 10)
  const { data } = await supabase
    .from('completed_sessions').select('date, actual_rpe, actual_type')
    .eq('user_id', userId).gte('date', fromDate).order('date', { ascending: true })
  return (data ?? [])
    .filter((r) => r.actual_rpe != null)
    .map((r) => ({ date: r.date, rpe: r.actual_rpe as number, type: r.actual_type }))
}
```

- [ ] **Step 2: `src/lib/journal.ts`**

```ts
import { supabase } from './supabase'

export interface JournalEntry {
  id: string
  date: string
  body: string
  created_at: string
}

/** Load journal entries (newest first). If `query` is set, filter by body (case-insensitive). */
export async function loadJournal(userId: string, query?: string): Promise<JournalEntry[]> {
  let q = supabase
    .from('journal_entries').select('id, date, body, created_at')
    .eq('user_id', userId).order('date', { ascending: false }).order('created_at', { ascending: false })
  if (query && query.trim()) q = q.ilike('body', `%${query.trim()}%`)
  const { data } = await q
  return (data as JournalEntry[]) ?? []
}
```

- [ ] **Step 3:** `npm run build`. Commit — `git add -A && git commit -m "feat: progress + journal client loaders"`

---

## Task 3: WeeklySummary + RpeTrend components

**Files:** Create `src/components/WeeklySummary.tsx`, `src/components/RpeTrend.tsx`

- [ ] **Step 1: `src/components/WeeklySummary.tsx`**

```tsx
import { Card } from './ui'
import type { WeekProgress } from '../lib/progressStats'

const DECISION_LABEL: Record<string, string> = {
  scale_down: 'scaled down', scale_up: 'scaled up', change_modality: 'changed', rest: 'rest',
}

export function WeeklySummary({ summary }: { summary: WeekProgress }) {
  const types = Object.entries(summary.byType)
  return (
    <Card>
      <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted">This week</h2>
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Completed" value={`${summary.completed}/${summary.planned}`} />
        <Stat label="Adherence" value={`${summary.adherencePct}%`} accent />
        <Stat label="Avg RPE" value={summary.avgActualRpe != null ? String(summary.avgActualRpe) : '—'} />
      </div>

      {types.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {types.map(([t, n]) => (
            <span key={t} className="rounded-full bg-surface-2 px-3 py-1 text-xs text-muted">
              {t}: {n}
            </span>
          ))}
        </div>
      )}

      {summary.adjustments.length > 0 && (
        <div className="mt-4 border-t border-border pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">Coach adjustments</p>
          <ul className="mt-2 flex flex-col gap-1 text-sm">
            {summary.adjustments.map((a) => (
              <li key={a.date} className="flex justify-between">
                <span className="text-muted">{a.date}</span>
                <span className="text-accent">{DECISION_LABEL[a.decision] ?? a.decision}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-xs text-muted">{label}</div>
      <div className={`text-2xl font-semibold ${accent ? 'text-accent' : 'text-text'}`}>{value}</div>
    </div>
  )
}
```

- [ ] **Step 2: `src/components/RpeTrend.tsx`** (CSS bars, no chart lib)

```tsx
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
```

- [ ] **Step 3:** `npm run build`. Commit — `git add -A && git commit -m "feat: weekly summary + RPE trend components"`

---

## Task 4: Progress page

**Files:** Rewrite `src/pages/Progress.tsx`

- [ ] **Step 1:**

```tsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../auth/useSession'
import { loadWeekProgress, loadRpeSeries, type RpePoint } from '../lib/progress'
import type { WeekProgress } from '../lib/progressStats'
import { WeeklySummary } from '../components/WeeklySummary'
import { RpeTrend } from '../components/RpeTrend'
import { Card } from '../components/ui'

export default function Progress() {
  const { session } = useSession()
  const uid = session?.user?.id
  const [summary, setSummary] = useState<WeekProgress | null>(null)
  const [points, setPoints] = useState<RpePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    Promise.all([loadWeekProgress(uid), loadRpeSeries(uid)])
      .then(([w, s]) => {
        setSummary(w.summary)
        setPoints(s)
      })
      .finally(() => setLoading(false))
  }, [uid])

  if (loading) return <Card><p className="text-muted">Loading…</p></Card>

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Progress</h1>
      {summary && <WeeklySummary summary={summary} />}
      <RpeTrend points={points} />
      <Card>
        <p className="text-sm text-muted">
          Reviewing your notes? Your full training diary is in the{' '}
          <Link to="/journal" className="text-accent">Journal</Link>.
        </p>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2:** `npm run build`. Commit — `git add -A && git commit -m "feat: progress page"`

---

## Task 5: Journal page

**Files:** Rewrite `src/pages/Journal.tsx`

- [ ] **Step 1:**

```tsx
import { useEffect, useState } from 'react'
import { useSession } from '../auth/useSession'
import { loadJournal, type JournalEntry } from '../lib/journal'
import { Card, Input } from '../components/ui'

export default function Journal() {
  const { session } = useSession()
  const uid = session?.user?.id
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    const t = setTimeout(() => {
      loadJournal(uid, query).then(setEntries).finally(() => setLoading(false))
    }, query ? 250 : 0) // debounce searches
    return () => clearTimeout(t)
  }, [uid, query])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Journal</h1>
      <Input
        type="search"
        placeholder="Search your notes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading && <Card><p className="text-muted">Loading…</p></Card>}
      {!loading && entries.length === 0 && (
        <Card><p className="text-muted">{query ? 'No entries match that search.' : 'No journal entries yet — they come from your daily check-ins.'}</p></Card>
      )}
      {entries.map((e) => (
        <Card key={e.id}>
          <p className="text-xs font-medium uppercase tracking-wide text-accent">{e.date}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-text">{e.body}</p>
        </Card>
      ))}
    </div>
  )
}
```

- [ ] **Step 2:** `npm run build`. Commit — `git add -A && git commit -m "feat: searchable journal page"`

---

## Task 6: Re-add Journal + Progress to nav

**Files:** Modify `src/components/AppShell.tsx`

- [ ] **Step 1:** Set `tabs` to include all built surfaces:
```ts
const tabs = [
  { to: '/', label: 'Today' },
  { to: '/week', label: 'Week' },
  { to: '/coach', label: 'Coach' },
  { to: '/journal', label: 'Journal' },
  { to: '/progress', label: 'Progress' },
  { to: '/profile', label: 'Profile' },
]
```
(The `/journal` and `/progress` routes already exist in `App.tsx` from Phase 0 — no route changes needed.)

- [ ] **Step 2:** Verify the mobile bottom bar still fits 6 short labels (it uses `justify-around` + `flex`; labels are short). If cramped on a 375px viewport, reduce the `NavItem` compact padding — but do not remove tabs.

- [ ] **Step 3:** `npm run build` + `npm test` (all green). Commit — `git add -A && git commit -m "feat: re-add Journal + Progress to nav"`

---

## Task 7 (CHECKPOINT — interactive with Corey): Verify

Dev server serves the app. Corey signed in; needs some completed sessions + journal entries (from Phase 3/4 testing) for data to show.

- [ ] **Step 1:** Nav shows all 6 tabs (Today/Week/Coach/Journal/Progress/Profile) on desktop side-nav and mobile bottom bar.
- [ ] **Step 2:** Progress → "This week" shows completed/planned, adherence %, avg RPE, by-type chips, and any coach adjustments (from days you checked in and got scaled/changed/rest). RPE trend shows bars once sessions are logged.
- [ ] **Step 3:** Journal → lists entries from your check-ins (newest first); typing in the search box filters by note text.
- [ ] **Step 4:** Screenshot Progress + Journal; share.
- [ ] **Step 5:** Merge `phase-5-progress` into `main` (auto-deploys to Vercel).

---

## Definition of Done (Phase 5)

- `npm run build` + `npm test` pass (progressStats suite added).
- Progress shows completed-vs-planned, adherence, avg RPE, session-type breakdown, and coach adjustments for the week, plus an RPE trend.
- Journal lists check-in notes newest-first and filters by a case-insensitive search.
- Journal + Progress are back in the nav; their routes already existed.
- No new LLM calls or DB migrations.
