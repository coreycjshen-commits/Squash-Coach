# Squash Coach — Phase 1: Onboarding + Macrocycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the onboarding placeholder with a real multi-step form that writes the athlete profile, then deterministically generate a periodized macrocycle from their goal date (or a rolling block), and surface the current training phase.

**Architecture:** A pure, unit-tested `buildMacrocycle()` computes phase boundaries from start/goal dates using standard squash periodization; a pure `currentPhase()` maps "today" to a phase. The onboarding UI is a controlled multi-step form over a single `OnboardingData` object; on submit it upserts `profiles` (setting `onboarding_complete = true`), inserts the `macrocycles` row, refreshes session profile, and navigates to `/`. The Profile page reuses the same field components to edit the profile and shows the macrocycle overview + current phase.

**Tech Stack:** Same as Phase 0. New UI primitives: `Select`, `Textarea`, `RadioCards`, `Field`. New logic modules under `src/lib/`. All DB writes go through `src/lib/profile.ts` and `src/lib/macrocycle.ts`.

---

## File Structure (Phase 1)

```
src/
├── lib/
│   ├── macrocycle.ts          # buildMacrocycle(), currentPhase(), types (PURE)
│   ├── macrocycle.test.ts     # TDD
│   ├── profile.ts             # ProfileData type + saveOnboarding() + updateProfile() (Supabase writes)
│   └── dates.ts               # tiny date helpers (weeksBetween, addWeeks) (PURE)
│   └── dates.test.ts          # TDD
├── components/ui/
│   ├── Select.tsx             # styled <select>
│   ├── Textarea.tsx
│   ├── RadioCards.tsx         # big tappable option cards (playstyle, gym access)
│   ├── Field.tsx              # label + hint + children wrapper
│   └── index.ts               # (extend barrel)
├── onboarding/
│   ├── steps.tsx              # step definitions (title + fields), the ordered array
│   ├── OnboardingForm.tsx     # stepper container: state, next/back, progress, submit
│   └── fields.tsx             # the per-field render helpers shared with Profile edit
└── pages/
    ├── Onboarding.tsx         # (rewrite) renders OnboardingForm
    └── Profile.tsx            # (rewrite) edit profile + macrocycle/current-phase view
```

---

## Task 1: Date helpers (TDD)

**Files:** Create `src/lib/dates.ts`, `src/lib/dates.test.ts`

- [ ] **Step 1: Write failing test `src/lib/dates.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { weeksBetween, addWeeks, todayISO } from './dates'

describe('weeksBetween', () => {
  it('counts whole weeks, rounding up a partial week', () => {
    expect(weeksBetween('2026-01-01', '2026-01-01')).toBe(0)
    expect(weeksBetween('2026-01-01', '2026-01-08')).toBe(1)
    expect(weeksBetween('2026-01-01', '2026-01-10')).toBe(2) // 9 days -> 2 weeks
    expect(weeksBetween('2026-01-01', '2026-03-26')).toBe(12) // 84 days
  })
  it('returns 0 when end is before start', () => {
    expect(weeksBetween('2026-02-01', '2026-01-01')).toBe(0)
  })
})

describe('addWeeks', () => {
  it('adds N weeks and returns an ISO date string', () => {
    expect(addWeeks('2026-01-01', 2)).toBe('2026-01-15')
  })
})

describe('todayISO', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
```

- [ ] **Step 2: Run `npx vitest run src/lib/dates.test.ts` — expect FAIL (module missing).**

- [ ] **Step 3: Implement `src/lib/dates.ts`**

```ts
const MS_PER_DAY = 86_400_000

/** Whole weeks from start to end, rounding a partial week UP. 0 if end <= start. */
export function weeksBetween(startISO: string, endISO: string): number {
  const start = Date.parse(startISO)
  const end = Date.parse(endISO)
  const days = Math.floor((end - start) / MS_PER_DAY)
  if (days <= 0) return 0
  return Math.ceil(days / 7)
}

/** start + n weeks, as YYYY-MM-DD (UTC-safe). */
export function addWeeks(startISO: string, n: number): string {
  const d = new Date(Date.parse(startISO) + n * 7 * MS_PER_DAY)
  return d.toISOString().slice(0, 10)
}

/** Local calendar date as YYYY-MM-DD. */
export function todayISO(): string {
  const now = new Date()
  const tzOffset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Run `npx vitest run src/lib/dates.test.ts` — expect PASS.**

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: date helpers (TDD)"`

---

## Task 2: Macrocycle generation (TDD)

Standard squash periodization. Phase names (exact strings, reused everywhere): `"General Prep"`, `"Specific Prep"`, `"Pre-Competitive / Power"`, `"Competition / Maintenance"`.

Rules:
- **Fixed goal, ≥ 4 weeks out:** distribute weeks by proportions General 0.35 / Specific 0.30 / Power 0.20 / Competition 0.15, each phase ≥ 1 week, using largest-remainder rounding so the parts sum exactly to total weeks. `block_type = 'fixed_goal'`.
- **Fixed goal, 1–3 weeks out:** single `"Competition / Maintenance"` phase spanning all weeks (peaking/taper). `block_type = 'fixed_goal'`.
- **No goal date:** rolling 10-week block, General 4 / Specific 4 / Power 2 (no competition phase — you're not peaking for anything). `block_type = 'rolling'`, `end_date = start + 10 weeks`.

**Files:** Create `src/lib/macrocycle.ts`, `src/lib/macrocycle.test.ts`

- [ ] **Step 1: Write failing test `src/lib/macrocycle.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildMacrocycle, currentPhase, type Macrocycle } from './macrocycle'

describe('buildMacrocycle', () => {
  it('rolling 10-week block when no goal date', () => {
    const m = buildMacrocycle('2026-01-01', null)
    expect(m.block_type).toBe('rolling')
    expect(m.start_date).toBe('2026-01-01')
    expect(m.end_date).toBe('2026-03-12') // +10 weeks
    expect(m.phases).toEqual([
      { name: 'General Prep', start_week: 1, end_week: 4 },
      { name: 'Specific Prep', start_week: 5, end_week: 8 },
      { name: 'Pre-Competitive / Power', start_week: 9, end_week: 10 },
    ])
  })

  it('fixed-goal 12-week block splits 4 phases summing to total', () => {
    const m = buildMacrocycle('2026-01-01', '2026-03-26') // 12 weeks
    expect(m.block_type).toBe('fixed_goal')
    expect(m.end_date).toBe('2026-03-26')
    const total = m.phases.reduce((n, p) => n + (p.end_week - p.start_week + 1), 0)
    expect(total).toBe(12)
    expect(m.phases.map((p) => p.name)).toEqual([
      'General Prep',
      'Specific Prep',
      'Pre-Competitive / Power',
      'Competition / Maintenance',
    ])
    // 12 * [.35,.30,.20,.15] = [4.2,3.6,2.4,1.8] -> largest remainder -> 4,4,2,2
    expect(m.phases.map((p) => p.end_week - p.start_week + 1)).toEqual([4, 4, 2, 2])
    // contiguous, 1-indexed
    expect(m.phases[0].start_week).toBe(1)
    expect(m.phases[3].end_week).toBe(12)
  })

  it('every phase gets at least 1 week in a short 4-week fixed goal', () => {
    const m = buildMacrocycle('2026-01-01', '2026-01-29') // 4 weeks
    expect(m.phases.map((p) => p.end_week - p.start_week + 1)).toEqual([1, 1, 1, 1])
  })

  it('sub-4-week goal collapses to a single peak phase', () => {
    const m = buildMacrocycle('2026-01-01', '2026-01-15') // 2 weeks
    expect(m.block_type).toBe('fixed_goal')
    expect(m.phases).toEqual([
      { name: 'Competition / Maintenance', start_week: 1, end_week: 2 },
    ])
  })
})

describe('currentPhase', () => {
  const m: Macrocycle = buildMacrocycle('2026-01-01', '2026-03-26') // 4,4,2,2
  it('returns General Prep in week 1', () => {
    expect(currentPhase(m, '2026-01-01').name).toBe('General Prep')
  })
  it('returns Specific Prep in week 5', () => {
    expect(currentPhase(m, '2026-01-29').name).toBe('Specific Prep')
  })
  it('clamps past the end to the final phase', () => {
    expect(currentPhase(m, '2026-05-01').name).toBe('Competition / Maintenance')
  })
  it('clamps before the start to the first phase', () => {
    expect(currentPhase(m, '2025-12-01').name).toBe('General Prep')
  })
})
```

- [ ] **Step 2: Run `npx vitest run src/lib/macrocycle.test.ts` — expect FAIL.**

- [ ] **Step 3: Implement `src/lib/macrocycle.ts`**

```ts
import { weeksBetween, addWeeks } from './dates'

export type BlockType = 'fixed_goal' | 'rolling'
export interface Phase {
  name: string
  start_week: number
  end_week: number
}
export interface Macrocycle {
  start_date: string
  end_date: string | null
  block_type: BlockType
  phases: Phase[]
}

const FULL_NAMES = [
  'General Prep',
  'Specific Prep',
  'Pre-Competitive / Power',
  'Competition / Maintenance',
] as const
const FULL_PROPORTIONS = [0.35, 0.3, 0.2, 0.15]

const ROLLING_WEEKS = 10
const ROLLING_NAMES = ['General Prep', 'Specific Prep', 'Pre-Competitive / Power']
const ROLLING_COUNTS = [4, 4, 2]

/** Distribute `total` across `proportions` with each part >= 1, using largest-remainder. */
function distribute(total: number, proportions: number[]): number[] {
  const n = proportions.length
  const raw = proportions.map((p) => p * total)
  const floors = raw.map((x) => Math.max(1, Math.floor(x)))
  let sum = floors.reduce((a, b) => a + b, 0)
  // If min-1 already overshoots (tiny totals), trim from the largest parts.
  while (sum > total) {
    let idx = 0
    for (let i = 1; i < n; i++) if (floors[i] > floors[idx]) idx = i
    if (floors[idx] <= 1) break
    floors[idx]--
    sum--
  }
  // Distribute the remainder to the largest fractional parts.
  const remainders = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac)
  let k = 0
  while (sum < total) {
    floors[remainders[k % n].i]++
    sum++
    k++
  }
  return floors
}

function toPhases(names: readonly string[], counts: number[]): Phase[] {
  const phases: Phase[] = []
  let week = 1
  names.forEach((name, i) => {
    const len = counts[i]
    phases.push({ name, start_week: week, end_week: week + len - 1 })
    week += len
  })
  return phases
}

export function buildMacrocycle(startISO: string, goalISO: string | null): Macrocycle {
  if (!goalISO) {
    return {
      start_date: startISO,
      end_date: addWeeks(startISO, ROLLING_WEEKS),
      block_type: 'rolling',
      phases: toPhases(ROLLING_NAMES, ROLLING_COUNTS),
    }
  }

  const totalWeeks = Math.max(1, weeksBetween(startISO, goalISO))
  if (totalWeeks < 4) {
    return {
      start_date: startISO,
      end_date: goalISO,
      block_type: 'fixed_goal',
      phases: [{ name: 'Competition / Maintenance', start_week: 1, end_week: totalWeeks }],
    }
  }

  const counts = distribute(totalWeeks, FULL_PROPORTIONS)
  return {
    start_date: startISO,
    end_date: goalISO,
    block_type: 'fixed_goal',
    phases: toPhases(FULL_NAMES, counts),
  }
}

/** The phase containing `todayISO`, clamped to the first/last phase outside the block. */
export function currentPhase(m: Macrocycle, todayISO: string): Phase {
  const week = weeksBetween(m.start_date, todayISO) + 1 // 1-indexed
  const first = m.phases[0]
  const last = m.phases[m.phases.length - 1]
  if (week <= first.start_week) return first
  const hit = m.phases.find((p) => week >= p.start_week && week <= p.end_week)
  return hit ?? last
}
```

- [ ] **Step 4: Run `npx vitest run src/lib/macrocycle.test.ts` — expect PASS.**

- [ ] **Step 5: Commit** — `git add -A && git commit -m "feat: deterministic macrocycle generation (TDD)"`

---

## Task 3: New UI primitives (Select, Textarea, RadioCards, Field)

**Files:** Create `src/components/ui/Select.tsx`, `Textarea.tsx`, `RadioCards.tsx`, `Field.tsx`; modify `src/components/ui/index.ts`.

- [ ] **Step 1: `src/components/ui/Field.tsx`**

```tsx
import type { ReactNode } from 'react'

export function Field({
  label, hint, children, htmlFor,
}: { label: string; hint?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-text">
        {label}
      </label>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      {children}
    </div>
  )
}
```

- [ ] **Step 2: `src/components/ui/Select.tsx`**

```tsx
import { forwardRef, type SelectHTMLAttributes } from 'react'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className = '', children, ...rest }, ref) => (
    <select
      ref={ref}
      className={`rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-text
        outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 ${className}`}
      {...rest}
    >
      {children}
    </select>
  ),
)
Select.displayName = 'Select'
```

- [ ] **Step 3: `src/components/ui/Textarea.tsx`**

```tsx
import { forwardRef, type TextareaHTMLAttributes } from 'react'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className = '', ...rest }, ref) => (
    <textarea
      ref={ref}
      className={`min-h-24 rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-text
        placeholder:text-muted/60 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 ${className}`}
      {...rest}
    />
  ),
)
Textarea.displayName = 'Textarea'
```

- [ ] **Step 4: `src/components/ui/RadioCards.tsx`**

```tsx
export interface RadioOption {
  value: string
  label: string
  description?: string
}

export function RadioCards({
  options, value, onChange, name,
}: {
  options: RadioOption[]
  value: string | null
  onChange: (v: string) => void
  name: string
}) {
  return (
    <div className="flex flex-col gap-2.5" role="radiogroup" aria-label={name}>
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            type="button"
            key={o.value}
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={`rounded-2xl border p-4 text-left transition ${
              selected
                ? 'border-accent bg-accent/10'
                : 'border-border bg-surface hover:border-muted'
            }`}
          >
            <div className="font-medium text-text">{o.label}</div>
            {o.description && <div className="mt-1 text-sm text-muted">{o.description}</div>}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Extend `src/components/ui/index.ts`** (keep existing exports, add):

```ts
export { Button } from './Button'
export { Card } from './Card'
export { Input } from './Input'
export { Select } from './Select'
export { Textarea } from './Textarea'
export { Field } from './Field'
export { RadioCards, type RadioOption } from './RadioCards'
```

- [ ] **Step 6: Verify build** — `npm run build` (expect pass). **Commit** — `git add -A && git commit -m "feat: form UI primitives (Select, Textarea, RadioCards, Field)"`

---

## Task 4: Profile data layer (types + Supabase writes)

**Files:** Create `src/lib/profile.ts`

- [ ] **Step 1: Implement `src/lib/profile.ts`**

```ts
import { supabase } from './supabase'
import { buildMacrocycle } from './macrocycle'
import { todayISO } from './dates'

export type Playstyle = 'attacking' | 'retrieving' | 'all_court'
export type GymAccess = 'full' | 'bodyweight' | 'none'

/** The editable athlete profile — mirrors the `profiles` table (minus system columns). */
export interface ProfileData {
  playstyle: Playstyle | null
  us_squash_rating: number | null
  level_descriptor: string | null
  years_playing: number | null
  weekly_oncourt_hours: number | null
  strength_experience: string | null
  days_per_week: number | null
  avg_session_min: number | null
  schedule_flexibility: string | null // 'fixed' | 'flexible'
  has_partner_default: boolean
  gym_access: GymAccess
  goal_type: string | null
  goal_target_date: string | null // YYYY-MM-DD or null
  injuries: string[]
}

export const EMPTY_PROFILE: ProfileData = {
  playstyle: null,
  us_squash_rating: null,
  level_descriptor: null,
  years_playing: null,
  weekly_oncourt_hours: null,
  strength_experience: null,
  days_per_week: null,
  avg_session_min: null,
  schedule_flexibility: 'flexible',
  has_partner_default: true,
  gym_access: 'full',
  goal_type: null,
  goal_target_date: null,
  injuries: [],
}

/** Load the current user's profile fields into a ProfileData shape (nulls if unset). */
export async function loadProfile(userId: string): Promise<ProfileData> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'playstyle, us_squash_rating, level_descriptor, years_playing, weekly_oncourt_hours, strength_experience, days_per_week, avg_session_min, schedule_flexibility, has_partner_default, gym_access, goal_type, goal_target_date, injuries',
    )
    .eq('id', userId)
    .single()
  if (error) throw error
  return { ...EMPTY_PROFILE, ...data, injuries: (data?.injuries as string[]) ?? [] }
}

/** Update profile fields only (used by the Profile edit page). */
export async function updateProfile(userId: string, p: ProfileData): Promise<void> {
  const { error } = await supabase.from('profiles').update(p).eq('id', userId)
  if (error) throw error
}

/**
 * Onboarding submit: save the profile, mark onboarding complete, and create the macrocycle.
 * Idempotent enough for a re-run: replaces any existing macrocycle for the user.
 */
export async function saveOnboarding(userId: string, p: ProfileData): Promise<void> {
  const { error: pErr } = await supabase
    .from('profiles')
    .update({ ...p, onboarding_complete: true })
    .eq('id', userId)
  if (pErr) throw pErr

  const start = todayISO()
  const m = buildMacrocycle(start, p.goal_target_date)

  // Remove any prior macrocycle so re-onboarding doesn't stack duplicates.
  await supabase.from('macrocycles').delete().eq('user_id', userId)

  const { error: mErr } = await supabase.from('macrocycles').insert({
    user_id: userId,
    start_date: m.start_date,
    end_date: m.end_date,
    block_type: m.block_type,
    phases: m.phases,
  })
  if (mErr) throw mErr
}

/** Load the user's macrocycle (or null). */
export async function loadMacrocycle(userId: string) {
  const { data } = await supabase
    .from('macrocycles')
    .select('start_date, end_date, block_type, phases')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}
```

- [ ] **Step 2: Verify build** — `npm run build`. **Commit** — `git add -A && git commit -m "feat: profile data layer + onboarding save"`

---

## Task 5: Onboarding step definitions + field renderers

**Files:** Create `src/onboarding/steps.tsx`

This module holds the step metadata and validation. Playstyle/gym options live here.

- [ ] **Step 1: Implement `src/onboarding/steps.tsx`**

```tsx
import type { ProfileData } from '../lib/profile'
import type { RadioOption } from '../components/ui'

export const PLAYSTYLE_OPTIONS: RadioOption[] = [
  {
    value: 'attacking',
    label: 'Attacking / shot-maker',
    description: 'You look to finish rallies early — kills, nicks, and short deception to take time away.',
  },
  {
    value: 'retrieving',
    label: 'Retrieving / counter-attacker',
    description: 'You defend deep, run everything down, and win by extending rallies and forcing errors.',
  },
  {
    value: 'all_court',
    label: 'All-court / balanced',
    description: 'You mix attack and defense, adapting shot selection to the situation.',
  },
]

export const GYM_OPTIONS: RadioOption[] = [
  { value: 'full', label: 'Full weight room', description: 'Barbells, dumbbells, racks.' },
  { value: 'bodyweight', label: 'Bodyweight / minimal', description: 'Bands, light dumbbells, no rack.' },
  { value: 'none', label: 'No gym access', description: 'Court and open space only.' },
]

export interface StepDef {
  id: string
  title: string
  subtitle: string
  /** returns an error string if this step's data is invalid, else null */
  validate: (d: ProfileData) => string | null
}

export const STEPS: StepDef[] = [
  {
    id: 'playstyle',
    title: 'How do you play?',
    subtitle: 'Pick the style that fits you best — the plan leans your training toward it.',
    validate: (d) => (d.playstyle ? null : 'Pick a playstyle to continue.'),
  },
  {
    id: 'level',
    title: 'Your level',
    subtitle:
      'US Squash rating runs ~1.0 (beginner) to 7.5+ (world class); the average adult is ~3.5. No rating? Describe your level instead.',
    validate: (d) =>
      d.us_squash_rating != null || (d.level_descriptor && d.level_descriptor.trim())
        ? null
        : 'Enter a rating or a short level description.',
  },
  {
    id: 'history',
    title: 'Training history',
    subtitle: 'Roughly how much you already train.',
    validate: (d) => (d.years_playing != null ? null : 'How many years have you played?'),
  },
  {
    id: 'availability',
    title: 'Weekly availability',
    subtitle: 'How much time you can commit in a normal week.',
    validate: (d) =>
      d.days_per_week && d.avg_session_min ? null : 'Set your days per week and session length.',
  },
  {
    id: 'access',
    title: 'Access',
    subtitle: 'What you can reliably get to — the plan adapts if you often train solo.',
    validate: () => null,
  },
  {
    id: 'goals',
    title: 'Goals',
    subtitle: 'What are you training toward? A target date sharpens the periodization.',
    validate: (d) => (d.goal_type && d.goal_type.trim() ? null : 'Tell me what you’re aiming for.'),
  },
  {
    id: 'injuries',
    title: 'Injuries & niggles',
    subtitle: 'Anything to build around or avoid loading. Leave blank if none.',
    validate: () => null,
  },
]
```

- [ ] **Step 2: Verify build** — `npm run build`. **Commit** — `git add -A && git commit -m "feat: onboarding step definitions"`

---

## Task 6: The multi-step OnboardingForm

**Files:** Create `src/onboarding/OnboardingForm.tsx`, rewrite `src/pages/Onboarding.tsx`

- [ ] **Step 1: Implement `src/onboarding/OnboardingForm.tsx`**

```tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button, Card, Input, Select, Textarea, Field, RadioCards } from '../components/ui'
import { EMPTY_PROFILE, saveOnboarding, type ProfileData } from '../lib/profile'
import { useSession } from '../auth/useSession'
import { STEPS, PLAYSTYLE_OPTIONS, GYM_OPTIONS } from './steps'

/** Parse a number input into number | null (empty -> null). */
function num(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function OnboardingForm() {
  const nav = useNavigate()
  const { session, refreshProfile } = useSession()
  const [data, setData] = useState<ProfileData>(EMPTY_PROFILE)
  const [stepIdx, setStepIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const step = STEPS[stepIdx]
  const isLast = stepIdx === STEPS.length - 1
  const set = (patch: Partial<ProfileData>) => setData((d) => ({ ...d, ...patch }))

  async function next() {
    const err = step.validate(data)
    if (err) return setError(err)
    setError(null)
    if (!isLast) return setStepIdx((i) => i + 1)

    if (!session?.user) return setError('Your session expired — please sign in again.')
    setBusy(true)
    try {
      await saveOnboarding(session.user.id, data)
      await refreshProfile()
      nav('/', { replace: true })
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'Could not save your profile.')
    }
  }

  function back() {
    setError(null)
    setStepIdx((i) => Math.max(0, i - 1))
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center p-6">
      {/* progress */}
      <div className="mb-6 flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`h-1 flex-1 rounded-full ${i <= stepIdx ? 'bg-accent' : 'bg-border'}`}
          />
        ))}
      </div>

      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Step {stepIdx + 1} of {STEPS.length}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{step.title}</h1>
        <p className="mt-1.5 text-sm text-muted">{step.subtitle}</p>

        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="mt-6 flex flex-col gap-5"
          >
            {step.id === 'playstyle' && (
              <RadioCards
                name="playstyle"
                options={PLAYSTYLE_OPTIONS}
                value={data.playstyle}
                onChange={(v) => set({ playstyle: v as ProfileData['playstyle'] })}
              />
            )}

            {step.id === 'level' && (
              <>
                <Field label="US Squash rating" hint="Optional — leave blank if you don't have one." htmlFor="rating">
                  <Input
                    id="rating" type="number" step="0.1" min="1" max="8"
                    placeholder="e.g. 4.5"
                    value={data.us_squash_rating ?? ''}
                    onChange={(e) => set({ us_squash_rating: num(e.target.value) })}
                  />
                </Field>
                <Field label="Or describe your level" hint="PSA / college / club, national junior background, etc." htmlFor="leveldesc">
                  <Input
                    id="leveldesc" type="text"
                    placeholder="e.g. college varsity, former national junior"
                    value={data.level_descriptor ?? ''}
                    onChange={(e) => set({ level_descriptor: e.target.value })}
                  />
                </Field>
              </>
            )}

            {step.id === 'history' && (
              <>
                <Field label="Years playing" htmlFor="years">
                  <Input id="years" type="number" step="0.5" min="0" placeholder="e.g. 8"
                    value={data.years_playing ?? ''} onChange={(e) => set({ years_playing: num(e.target.value) })} />
                </Field>
                <Field label="Current on-court hours / week" htmlFor="oncourt">
                  <Input id="oncourt" type="number" step="0.5" min="0" placeholder="e.g. 5"
                    value={data.weekly_oncourt_hours ?? ''} onChange={(e) => set({ weekly_oncourt_hours: num(e.target.value) })} />
                </Field>
                <Field label="Strength-training experience" htmlFor="strength">
                  <Select id="strength" value={data.strength_experience ?? ''}
                    onChange={(e) => set({ strength_experience: e.target.value })}>
                    <option value="">Select…</option>
                    <option value="none">None</option>
                    <option value="beginner">Beginner (&lt;1 yr)</option>
                    <option value="intermediate">Intermediate (1–3 yrs)</option>
                    <option value="advanced">Advanced (3+ yrs)</option>
                  </Select>
                </Field>
              </>
            )}

            {step.id === 'availability' && (
              <>
                <Field label="Training days per week" htmlFor="days">
                  <Select id="days" value={data.days_per_week ?? ''}
                    onChange={(e) => set({ days_per_week: num(e.target.value) })}>
                    <option value="">Select…</option>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </Field>
                <Field label="Average session length (minutes)" htmlFor="sesslen">
                  <Input id="sesslen" type="number" step="15" min="15" placeholder="e.g. 60"
                    value={data.avg_session_min ?? ''} onChange={(e) => set({ avg_session_min: num(e.target.value) })} />
                </Field>
                <Field label="Is your schedule fixed or flexible?" htmlFor="flex">
                  <Select id="flex" value={data.schedule_flexibility ?? 'flexible'}
                    onChange={(e) => set({ schedule_flexibility: e.target.value })}>
                    <option value="flexible">Flexible — I can move sessions around</option>
                    <option value="fixed">Fixed — specific days/times each week</option>
                  </Select>
                </Field>
              </>
            )}

            {step.id === 'access' && (
              <>
                <Field label="Do you usually have a hitting partner / coach?">
                  <div className="flex gap-2">
                    <Button type="button" variant={data.has_partner_default ? 'primary' : 'secondary'}
                      onClick={() => set({ has_partner_default: true })}>Usually yes</Button>
                    <Button type="button" variant={!data.has_partner_default ? 'primary' : 'secondary'}
                      onClick={() => set({ has_partner_default: false })}>Often solo</Button>
                  </div>
                </Field>
                <Field label="Gym access">
                  <RadioCards name="gym" options={GYM_OPTIONS} value={data.gym_access}
                    onChange={(v) => set({ gym_access: v as ProfileData['gym_access'] })} />
                </Field>
              </>
            )}

            {step.id === 'goals' && (
              <>
                <Field label="What are you training toward?" htmlFor="goal">
                  <Input id="goal" type="text"
                    placeholder="e.g. peak for college season, off-season base, injury return"
                    value={data.goal_type ?? ''} onChange={(e) => set({ goal_type: e.target.value })} />
                </Field>
                <Field label="Target date" hint="Optional — if you're peaking for something. Blank = rolling block." htmlFor="goaldate">
                  <Input id="goaldate" type="date"
                    value={data.goal_target_date ?? ''} onChange={(e) => set({ goal_target_date: e.target.value || null })} />
                </Field>
              </>
            )}

            {step.id === 'injuries' && (
              <Field label="Injuries or niggles" hint="One per line. The plan will avoid loading these." htmlFor="inj">
                <Textarea id="inj"
                  placeholder={'e.g. right knee tendinitis\nleft shoulder impingement'}
                  value={data.injuries.join('\n')}
                  onChange={(e) => set({ injuries: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                />
              </Field>
            )}
          </motion.div>
        </AnimatePresence>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-8 flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={back} disabled={stepIdx === 0 || busy}>
            Back
          </Button>
          <Button type="button" onClick={next} disabled={busy}>
            {busy ? 'Saving…' : isLast ? 'Finish & build my plan' : 'Next'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `src/pages/Onboarding.tsx`**

```tsx
import { OnboardingForm } from '../onboarding/OnboardingForm'

export default function Onboarding() {
  return <OnboardingForm />
}
```

- [ ] **Step 3: Verify build + tests** — `npm run build` and `npm test` (all prior tests still pass). **Commit** — `git add -A && git commit -m "feat: multi-step onboarding form"`

---

## Task 7: Profile page — edit profile + macrocycle overview

**Files:** Rewrite `src/pages/Profile.tsx`

- [ ] **Step 1: Implement `src/pages/Profile.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../auth/useSession'
import {
  loadProfile, updateProfile, loadMacrocycle, EMPTY_PROFILE, type ProfileData,
} from '../lib/profile'
import { currentPhase, type Macrocycle } from '../lib/macrocycle'
import { todayISO } from '../lib/dates'
import { Button, Card, Input, Field } from '../components/ui'

export default function Profile() {
  const { session } = useSession()
  const uid = session?.user?.id
  const [data, setData] = useState<ProfileData>(EMPTY_PROFILE)
  const [macro, setMacro] = useState<Macrocycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return
    Promise.all([loadProfile(uid), loadMacrocycle(uid)])
      .then(([p, m]) => {
        setData(p)
        setMacro(m as Macrocycle | null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profile.'))
      .finally(() => setLoading(false))
  }, [uid])

  async function save() {
    if (!uid) return
    setSaved(false)
    setError(null)
    try {
      await updateProfile(uid, data)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    }
  }

  if (loading) return <Card><p className="text-muted">Loading…</p></Card>

  const phase = macro ? currentPhase(macro, todayISO()) : null

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Your profile</h1>
          <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Sign out</Button>
        </div>
      </Card>

      {macro && phase && (
        <Card>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Current training block</h2>
          <p className="mt-1 text-lg font-semibold text-accent">{phase.name}</p>
          <p className="text-sm text-muted">
            {macro.block_type === 'rolling' ? 'Rolling block' : 'Peaking block'} ·
            {' '}{macro.start_date}{macro.end_date ? ` → ${macro.end_date}` : ''}
          </p>
          <div className="mt-3 flex flex-col gap-1">
            {macro.phases.map((p) => (
              <div key={p.name} className={`flex justify-between rounded-lg px-3 py-2 text-sm ${
                p.name === phase.name ? 'bg-accent/10 text-text' : 'text-muted'
              }`}>
                <span>{p.name}</span>
                <span>wk {p.start_week}–{p.end_week}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted">Edit details</h2>
        <div className="flex flex-col gap-4">
          <Field label="US Squash rating" htmlFor="p-rating">
            <Input id="p-rating" type="number" step="0.1" value={data.us_squash_rating ?? ''}
              onChange={(e) => setData({ ...data, us_squash_rating: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Level description" htmlFor="p-level">
            <Input id="p-level" type="text" value={data.level_descriptor ?? ''}
              onChange={(e) => setData({ ...data, level_descriptor: e.target.value })} />
          </Field>
          <Field label="Training days per week" htmlFor="p-days">
            <Input id="p-days" type="number" min="1" max="7" value={data.days_per_week ?? ''}
              onChange={(e) => setData({ ...data, days_per_week: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Goal" htmlFor="p-goal">
            <Input id="p-goal" type="text" value={data.goal_type ?? ''}
              onChange={(e) => setData({ ...data, goal_type: e.target.value })} />
          </Field>
          <Field label="Injuries (one per line)" htmlFor="p-inj">
            <Input id="p-inj" type="text" value={data.injuries.join(', ')}
              onChange={(e) => setData({ ...data, injuries: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </Field>
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {saved && <p className="mt-4 text-sm text-accent">Saved.</p>}
        <div className="mt-6">
          <Button onClick={save}>Save changes</Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Changing your goal date won't rebuild your training block automatically — re-run onboarding for that.
        </p>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Verify build + tests** — `npm run build`, `npm test`. **Commit** — `git add -A && git commit -m "feat: profile edit page + macrocycle overview"`

---

## Task 8 (CHECKPOINT — interactive with Corey): End-to-end verification

Drive the running dev server (`squash-dev`, port 5173) with the browser tools. Corey is already signed up and sitting on `/onboarding`.

- [ ] **Step 1:** Reload `/onboarding`; confirm the step-1 playstyle cards render in the navy/amber system with the progress bar.
- [ ] **Step 2:** Ask Corey to walk through the 7 steps in his own browser (he enters real values), OR drive it via browser tools with placeholder values to verify flow, then have Corey redo with real values. Since the final submit writes Corey's real profile, prefer letting Corey fill it. Confirm validation blocks empty required steps.
- [ ] **Step 3:** After Corey finishes, confirm redirect to `/` (Today placeholder) and that re-navigating to `/onboarding` now bounces to `/` (gate: onboarded users can't re-enter). 
- [ ] **Step 4:** Go to `/profile`; confirm the current-phase card shows a phase name and the phase list, and the edit form is pre-filled with Corey's values.
- [ ] **Step 5:** Verify persistence — query that `profiles.onboarding_complete = true` and a `macrocycles` row exists for the user (Corey can check Table Editor, or confirm via the app showing the phase card, which proves the macrocycle row was written).
- [ ] **Step 6:** Screenshot the onboarding step-1 and the profile phase card; share with Corey.
- [ ] **Step 7:** Merge `phase-1-onboarding` into `main`.

---

## Definition of Done (Phase 1)

- `npm run build` and `npm test` pass (dates + macrocycle test suites added and green, plus the Phase 0 gate tests).
- Completing onboarding writes all profile fields, sets `onboarding_complete = true`, creates a `macrocycles` row with correct deterministic phases, and lands on `/`.
- The gate no longer routes the onboarded user back to `/onboarding`.
- `/profile` shows the current phase + full phase breakdown and allows editing core fields.
- Solo/partner default, gym access, rating/level, goal + optional target date, and injuries are all captured.
