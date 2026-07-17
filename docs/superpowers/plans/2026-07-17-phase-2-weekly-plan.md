# Squash Coach — Phase 2: Weekly Plan Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Generate a personalized week of training via a server-side Groq call (grounded in squash periodization + the athlete's profile/phase), persist it as `weekly_plans` + `sessions`, and display it on `/week` with generate/re-plan and per-session manual edit. A deterministic template guarantees a plan even when the LLM is unavailable.

**Architecture:** Shared plan schema/types live in `src/lib/planSchema.ts` (imported by both the frontend and the serverless function). A pure `buildTemplateWeek()` encodes phase-appropriate session distribution (used as the LLM fallback AND first-run safety). The `/api/generate-week` Node serverless function authenticates the caller's Supabase JWT, builds a per-request RLS-bound client, gathers profile + macrocycle + last-week history, prompts Groq in JSON mode, validates with Zod, and on any failure falls back to the template — then persists the plan and logs the decision. The frontend calls the endpoint with the user's access token and renders sessions.

**Tech Stack:** Phase 0/1 stack + `@vercel/node` (function types), Groq via `fetch` to the OpenAI-compatible endpoint. `vercel dev` for local API execution. Groq mocked in unit tests.

---

## File Structure (Phase 2)

```
api/
├── _lib/                          # underscore = shared, NOT an endpoint
│   ├── supabaseServer.ts          # per-request RLS-bound client from Bearer token
│   ├── groq.ts                    # callGroqJSON() — OpenAI-compatible chat, JSON mode
│   └── prompt.ts                  # buildWeeklyMessages(profile, phase, history)
└── generate-week.ts               # the Node serverless handler
src/
├── lib/
│   ├── planSchema.ts              # Zod schemas + TS types for the weekly plan (SHARED)
│   ├── planSchema.test.ts         # TDD
│   ├── template.ts                # buildTemplateWeek() — pure, phase-aware fallback
│   ├── template.test.ts           # TDD
│   ├── week.ts                    # startOfWeekISO() — pure (Monday-based)
│   ├── week.test.ts               # TDD
│   └── plans.ts                   # client: current plan load, generate call, session edit
└── pages/
    └── Week.tsx                   # (rewrite) render plan, generate/re-plan, edit session
```

---

## Task 1: Week-start helper (TDD)

**Files:** Create `src/lib/week.ts`, `src/lib/week.test.ts`

- [ ] **Step 1: Failing test `src/lib/week.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { startOfWeekISO } from './week'

describe('startOfWeekISO', () => {
  it('returns the Monday of the week for a mid-week date', () => {
    // 2026-07-15 is a Wednesday -> Monday 2026-07-13
    expect(startOfWeekISO('2026-07-15')).toBe('2026-07-13')
  })
  it('returns the same date when it is already Monday', () => {
    expect(startOfWeekISO('2026-07-13')).toBe('2026-07-13')
  })
  it('treats Sunday as the end of the week (previous Monday)', () => {
    // 2026-07-19 is a Sunday -> Monday 2026-07-13
    expect(startOfWeekISO('2026-07-19')).toBe('2026-07-13')
  })
})
```

- [ ] **Step 2: Run `npx vitest run src/lib/week.test.ts` — expect FAIL.**

- [ ] **Step 3: Implement `src/lib/week.ts`**

```ts
const MS_PER_DAY = 86_400_000

/** Monday (ISO week start) for the given YYYY-MM-DD, as YYYY-MM-DD. */
export function startOfWeekISO(dateISO: string): string {
  const t = Date.parse(dateISO)
  const dow = new Date(t).getUTCDay() // 0=Sun..6=Sat
  const backToMonday = (dow + 6) % 7 // Mon->0, Sun->6
  return new Date(t - backToMonday * MS_PER_DAY).toISOString().slice(0, 10)
}
```

- [ ] **Step 4: Run test — expect PASS. Commit** — `git add -A && git commit -m "feat: week-start helper (TDD)"`

---

## Task 2: Shared plan schema + types (TDD)

Defines the contract the LLM must satisfy and both sides share.

**Files:** Create `src/lib/planSchema.ts`, `src/lib/planSchema.test.ts`

- [ ] **Step 1: Failing test `src/lib/planSchema.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { WeeklyPlanSchema, type WeeklyPlan } from './planSchema'

const valid: WeeklyPlan = {
  rationale: 'General prep: aerobic base + strength-endurance, court volume moderate.',
  sessions: [
    { day_index: 0, type: 'oncourt', focus: 'Length & movement', duration_min: 60, target_rpe: 6, detail: { drills: ['rails', 'boast-drive'] } },
    { day_index: 1, type: 'strength', focus: 'Lower-body power', duration_min: 45, target_rpe: 7, detail: { lifts: [{ name: 'Back squat', sets: 4, reps: 5 }] } },
    { day_index: 3, type: 'cardio', focus: 'Aerobic base', duration_min: 40, target_rpe: 5, detail: { format: 'steady state' } },
    { day_index: 5, type: 'rest', focus: 'Recovery', duration_min: 0, target_rpe: 1, detail: {} },
  ],
}

describe('WeeklyPlanSchema', () => {
  it('accepts a well-formed plan', () => {
    expect(WeeklyPlanSchema.safeParse(valid).success).toBe(true)
  })
  it('rejects an out-of-range RPE', () => {
    const bad = { ...valid, sessions: [{ ...valid.sessions[0], target_rpe: 15 }] }
    expect(WeeklyPlanSchema.safeParse(bad).success).toBe(false)
  })
  it('rejects an unknown session type', () => {
    const bad = { ...valid, sessions: [{ ...valid.sessions[0], type: 'yoga' }] }
    expect(WeeklyPlanSchema.safeParse(bad).success).toBe(false)
  })
  it('rejects a day_index outside 0-6', () => {
    const bad = { ...valid, sessions: [{ ...valid.sessions[0], day_index: 9 }] }
    expect(WeeklyPlanSchema.safeParse(bad).success).toBe(false)
  })
  it('rejects an empty sessions array', () => {
    expect(WeeklyPlanSchema.safeParse({ rationale: 'x', sessions: [] }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run test — expect FAIL.**

- [ ] **Step 3: Implement `src/lib/planSchema.ts`**

```ts
import { z } from 'zod'

export const SESSION_TYPES = ['oncourt', 'strength', 'cardio', 'rest'] as const

export const SessionSchema = z.object({
  day_index: z.number().int().min(0).max(6), // 0 = Monday .. 6 = Sunday
  type: z.enum(SESSION_TYPES),
  focus: z.string().min(1),
  duration_min: z.number().int().min(0).max(300),
  target_rpe: z.number().int().min(1).max(10),
  /** Free-form structured detail: lifts/sets/reps, interval structure, ghosting patterns, etc. */
  detail: z.record(z.string(), z.unknown()).default({}),
})
export type PlanSession = z.infer<typeof SessionSchema>

export const WeeklyPlanSchema = z.object({
  rationale: z.string().min(1),
  sessions: z.array(SessionSchema).min(1).max(7),
})
export type WeeklyPlan = z.infer<typeof WeeklyPlanSchema>
```

- [ ] **Step 4: Run test — expect PASS. Commit** — `git add -A && git commit -m "feat: shared weekly-plan schema (TDD)"`

---

## Task 3: Deterministic template week (TDD)

Phase-aware session distribution — the LLM fallback and first-run safety net. Encodes squash periodization: General Prep leans aerobic base + strength-endurance; Specific Prep leans max-strength + squash-specific + repeated-sprint; Pre-Competitive/Power leans plyo/explosive + taper; Competition/Maintenance leans court + light maintenance.

**Files:** Create `src/lib/template.ts`, `src/lib/template.test.ts`

- [ ] **Step 1: Failing test `src/lib/template.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { buildTemplateWeek } from './template'
import { WeeklyPlanSchema } from './planSchema'

describe('buildTemplateWeek', () => {
  it('produces exactly `days` non-rest sessions plus fills the week, matching the schema', () => {
    const plan = buildTemplateWeek('General Prep', 4, 60)
    expect(WeeklyPlanSchema.safeParse(plan).success).toBe(true)
    const training = plan.sessions.filter((s) => s.type !== 'rest')
    expect(training.length).toBe(4)
  })
  it('caps at 7 days and clamps silly inputs', () => {
    const plan = buildTemplateWeek('Specific Prep', 99, 60)
    expect(plan.sessions.length).toBeLessThanOrEqual(7)
    expect(plan.sessions.filter((s) => s.type !== 'rest').length).toBeLessThanOrEqual(7)
  })
  it('General Prep includes at least one cardio session', () => {
    const plan = buildTemplateWeek('General Prep', 5, 60)
    expect(plan.sessions.some((s) => s.type === 'cardio')).toBe(true)
  })
  it('Competition / Maintenance is court-dominant', () => {
    const plan = buildTemplateWeek('Competition / Maintenance', 4, 60)
    const court = plan.sessions.filter((s) => s.type === 'oncourt').length
    const other = plan.sessions.filter((s) => s.type !== 'oncourt' && s.type !== 'rest').length
    expect(court).toBeGreaterThanOrEqual(other)
  })
  it('every session satisfies duration/RPE ranges', () => {
    const plan = buildTemplateWeek('Pre-Competitive / Power', 3, 45)
    for (const s of plan.sessions) {
      expect(s.target_rpe).toBeGreaterThanOrEqual(1)
      expect(s.target_rpe).toBeLessThanOrEqual(10)
      expect(s.duration_min).toBeGreaterThanOrEqual(0)
    }
  })
})
```

- [ ] **Step 2: Run test — expect FAIL.**

- [ ] **Step 3: Implement `src/lib/template.ts`**

```ts
import type { WeeklyPlan, PlanSession } from './planSchema'
import { SESSION_TYPES } from './planSchema'

type TrainingType = Exclude<(typeof SESSION_TYPES)[number], 'rest'>

interface Slot {
  type: TrainingType
  focus: string
  rpe: number
  detail: Record<string, unknown>
}

/** Ordered priority of session slots per phase. We take the first `days` of these. */
const PHASE_SLOTS: Record<string, Slot[]> = {
  'General Prep': [
    { type: 'cardio', focus: 'Aerobic base — steady state', rpe: 5, detail: { format: '30–45 min continuous, zone 2' } },
    { type: 'oncourt', focus: 'Technical length & movement', rpe: 6, detail: { drills: ['straight rails', 'boast-drive', 'figure-8'] } },
    { type: 'strength', focus: 'Strength-endurance (higher reps)', rpe: 6, detail: { lifts: [{ name: 'Goblet squat', sets: 3, reps: 15 }, { name: 'Split squat', sets: 3, reps: 12 }, { name: 'Row', sets: 3, reps: 15 }] } },
    { type: 'oncourt', focus: 'Ghosting + court sprints', rpe: 7, detail: { pattern: '6-corner ghosting', sets: 5, work_sec: 45, rest_sec: 75 } },
    { type: 'cardio', focus: 'Aerobic intervals', rpe: 6, detail: { format: '5 x 3 min hard / 2 min easy' } },
    { type: 'strength', focus: 'Posterior chain + core', rpe: 6, detail: { lifts: [{ name: 'RDL', sets: 3, reps: 10 }, { name: 'Pallof press', sets: 3, reps: 12 }] } },
    { type: 'oncourt', focus: 'Solo hitting + touch', rpe: 5, detail: { drills: ['drops', 'rails'] } },
  ],
  'Specific Prep': [
    { type: 'strength', focus: 'Max strength — lower body', rpe: 8, detail: { lifts: [{ name: 'Back squat', sets: 4, reps: 5 }, { name: 'Trap-bar deadlift', sets: 4, reps: 5 }] } },
    { type: 'oncourt', focus: 'Squash-specific movement + ghosting', rpe: 8, detail: { pattern: 'figure-8 + front/back', sets: 6, work_sec: 40, rest_sec: 60 } },
    { type: 'oncourt', focus: 'Pressure drills / condition games', rpe: 7, detail: { drills: ['2-corner boast-drive', 'length game'] } },
    { type: 'cardio', focus: 'Repeated-sprint intervals', rpe: 9, detail: { format: '10 x 15s sprint / 45s rest' } },
    { type: 'strength', focus: 'Rotational core + shoulder durability', rpe: 7, detail: { lifts: [{ name: 'Cable rotation', sets: 3, reps: 10 }, { name: 'Cuff external rotation', sets: 3, reps: 15 }] } },
    { type: 'oncourt', focus: 'Match-specific patterns', rpe: 8, detail: { drills: ['deception', 'volley kill'] } },
    { type: 'cardio', focus: 'Tempo run', rpe: 6, detail: { format: '25 min steady' } },
  ],
  'Pre-Competitive / Power': [
    { type: 'strength', focus: 'Plyometrics + explosive power', rpe: 8, detail: { lifts: [{ name: 'Box jump', sets: 5, reps: 3 }, { name: 'Trap-bar jump', sets: 4, reps: 3 }] } },
    { type: 'oncourt', focus: 'Short explosive court movement', rpe: 8, detail: { pattern: 'front-court ghosting', sets: 6, work_sec: 20, rest_sec: 60 } },
    { type: 'oncourt', focus: 'Match play / condition games', rpe: 8, detail: { drills: ['best-of-3 games'] } },
    { type: 'oncourt', focus: 'Sharpening — touch & deception', rpe: 6, detail: { drills: ['drops', 'holds'] } },
    { type: 'cardio', focus: 'Short sharp intervals (taper)', rpe: 7, detail: { format: '6 x 20s / 60s' } },
    { type: 'strength', focus: 'Light maintenance power', rpe: 6, detail: { lifts: [{ name: 'Jump squat', sets: 3, reps: 4 }] } },
    { type: 'oncourt', focus: 'Solo rhythm hitting', rpe: 5, detail: { drills: ['rails'] } },
  ],
  'Competition / Maintenance': [
    { type: 'oncourt', focus: 'Match play', rpe: 8, detail: { drills: ['matches'] } },
    { type: 'oncourt', focus: 'Sharpening drills', rpe: 6, detail: { drills: ['drops', 'kills', 'length'] } },
    { type: 'oncourt', focus: 'Light movement + touch', rpe: 5, detail: { pattern: 'easy ghosting', sets: 3, work_sec: 30, rest_sec: 60 } },
    { type: 'strength', focus: 'Light maintenance lift', rpe: 5, detail: { lifts: [{ name: 'Squat', sets: 2, reps: 5 }, { name: 'Cuff work', sets: 2, reps: 15 }] } },
    { type: 'oncourt', focus: 'Pattern rehearsal', rpe: 6, detail: { drills: ['boast-drive'] } },
    { type: 'cardio', focus: 'Easy flush', rpe: 4, detail: { format: '20 min easy' } },
    { type: 'oncourt', focus: 'Pre-match hit', rpe: 5, detail: { drills: ['knock-up patterns'] } },
  ],
}

const FALLBACK_PHASE = 'General Prep'

/** Build a deterministic, phase-appropriate week. Fills `days` training days (1–7), rest for the remainder. */
export function buildTemplateWeek(phase: string, days: number, avgSessionMin: number): WeeklyPlan {
  const slots = PHASE_SLOTS[phase] ?? PHASE_SLOTS[FALLBACK_PHASE]
  const n = Math.max(1, Math.min(7, Math.floor(days) || 1))
  const dur = Math.max(20, Math.min(180, Math.floor(avgSessionMin) || 60))

  // Spread the n training days across the 7-day week as evenly as possible.
  const dayIndices = spreadDays(n)
  const sessions: PlanSession[] = []
  for (let i = 0; i < n; i++) {
    const slot = slots[i % slots.length]
    sessions.push({
      day_index: dayIndices[i],
      type: slot.type,
      focus: slot.focus,
      duration_min: slot.type === 'strength' ? Math.min(dur, 60) : dur,
      target_rpe: slot.rpe,
      detail: slot.detail,
    })
  }
  return {
    rationale: `${phase}: ${n} sessions this week from the standard ${phase.toLowerCase()} template (offline fallback).`,
    sessions,
  }
}

/** Choose `n` day indices (0–6) spread across the week. */
function spreadDays(n: number): number[] {
  if (n >= 7) return [0, 1, 2, 3, 4, 5, 6]
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(Math.round((i * 6) / Math.max(1, n - 1 || 1)))
  // de-dup / ensure strictly increasing for small n
  const seen = new Set<number>()
  return out.map((d) => {
    let v = d
    while (seen.has(v)) v = (v + 1) % 7
    seen.add(v)
    return v
  })
}
```

- [ ] **Step 4: Run test — expect PASS. Also run full `npm test` + `npm run build`. Commit** — `git add -A && git commit -m "feat: deterministic phase-aware template week (TDD)"`

---

## Task 4: Server helpers — Supabase-from-token + Groq client + prompt

Install `@vercel/node` first. These live under `api/_lib/` (not endpoints). `prompt.ts` is pure and could be unit-tested but is low-risk; focus tests on schema/template.

**Files:** Create `api/_lib/supabaseServer.ts`, `api/_lib/groq.ts`, `api/_lib/prompt.ts`. Modify `package.json` (dep).

- [ ] **Step 1: Install types** — `npm install -D @vercel/node`

- [ ] **Step 2: `api/_lib/supabaseServer.ts`**

```ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Build a Supabase client bound to the caller's access token so RLS applies server-side.
 * Returns null if the Authorization header is missing/malformed.
 */
export function clientFromRequest(authHeader: string | undefined): SupabaseClient | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Supabase env vars missing on server')
  return createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
```

- [ ] **Step 3: `api/_lib/groq.ts`**

```ts
/** Minimal Groq (OpenAI-compatible) JSON chat call. Throws on non-2xx or unparseable JSON. */
export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

export async function callGroqJSON(messages: ChatMessage[]): Promise<unknown> {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY missing')
  const model = process.env.GROQ_MODEL ?? 'llama-3.3-70b-versatile'

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.4,
      response_format: { type: 'json_object' },
    }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Groq ${res.status}: ${text.slice(0, 300)}`)
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] }
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Groq returned no content')
  return JSON.parse(content)
}
```

- [ ] **Step 4: `api/_lib/prompt.ts`**

```ts
import type { ChatMessage } from './groq'

export interface WeeklyPromptInput {
  profile: {
    playstyle: string | null
    us_squash_rating: number | null
    level_descriptor: string | null
    days_per_week: number | null
    avg_session_min: number | null
    has_partner_default: boolean
    gym_access: string
    goal_type: string | null
    injuries: string[]
  }
  phase: string
  weekStart: string
  lastWeek: {
    planned: number
    completed: number
    rpeTrend: string
    journalThemes: string
  }
}

const SYSTEM = `You are an elite squash strength & conditioning coach building ONE week of training.
Ground every choice in squash periodization and physiology:
- Phases: General Prep (aerobic base + strength-endurance, higher volume/lower intensity),
  Specific Prep (max strength + squash-specific movement, ghosting, repeated-sprint),
  Pre-Competitive / Power (plyometrics, short explosive court movement, tapering volume),
  Competition / Maintenance (mostly court + light maintenance lifting, protect freshness).
- Three training types: on-court (technical drills, ghosting/solo, or match play),
  strength (lower-body power, rotational core, shoulder/rotator-cuff durability — squash-specific,
  not bodybuilding), cardio (squash rallies are short, repeated high-intensity efforts, so favor
  interval formats over steady-state once a base exists).
- Intensity is an RPE 1–10 target per session.
Respect the athlete's available days, session length, gym access, partner availability, and injuries.
Distribute exactly the athlete's available days across session types appropriate to the CURRENT phase;
use the remaining days as rest.

Return STRICT JSON ONLY matching this shape:
{"rationale": string, "sessions": [{"day_index": 0-6 (0=Mon), "type": "oncourt"|"strength"|"cardio"|"rest",
"focus": string, "duration_min": int, "target_rpe": int 1-10, "detail": object}]}
"detail" holds the concrete session (e.g. lifts with sets/reps, interval structure, or ghosting patterns).
The rationale is 1-3 sentences explaining the mix you chose for this phase and athlete.`

export function buildWeeklyMessages(input: WeeklyPromptInput): ChatMessage[] {
  const p = input.profile
  const user = `ATHLETE
- Playstyle: ${p.playstyle ?? 'unspecified'}
- Level: ${p.us_squash_rating != null ? `US Squash ${p.us_squash_rating}` : p.level_descriptor ?? 'unspecified'}
- Available: ${p.days_per_week ?? 3} days/week, ~${p.avg_session_min ?? 60} min/session
- Gym access: ${p.gym_access}
- Usually has a hitting partner: ${p.has_partner_default ? 'yes' : 'no (favor solo/ghosting on-court sessions)'}
- Goal: ${p.goal_type ?? 'general development'}
- Injuries to work around: ${p.injuries.length ? p.injuries.join('; ') : 'none'}

CONTEXT
- Current macrocycle phase: ${input.phase}
- Week starting: ${input.weekStart}
- Last week: ${input.lastWeek.completed}/${input.lastWeek.planned} sessions completed; RPE trend: ${input.lastWeek.rpeTrend}; journal themes: ${input.lastWeek.journalThemes}

Generate this week's plan now as JSON.`
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ]
}
```

- [ ] **Step 5: Build check** — `npm run build` (these files are outside `src`, excluded from the app tsconfig; confirm the app build is unaffected). Commit — `git add -A && git commit -m "feat: server helpers (supabase-from-token, groq client, weekly prompt)"`

---

## Task 5: The `/api/generate-week` serverless handler

Orchestrates: auth → gather data → LLM (with fallback) → persist → log.

**Files:** Create `api/generate-week.ts`

- [ ] **Step 1: Implement `api/generate-week.ts`**

```ts
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clientFromRequest } from './_lib/supabaseServer'
import { callGroqJSON } from './_lib/groq'
import { buildWeeklyMessages } from './_lib/prompt'
import { WeeklyPlanSchema, type WeeklyPlan } from '../src/lib/planSchema'
import { buildTemplateWeek } from '../src/lib/template'
import { currentPhase, type Macrocycle } from '../src/lib/macrocycle'
import { startOfWeekISO } from '../src/lib/week'
import { addWeeks } from '../src/lib/dates'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = clientFromRequest(req.headers.authorization)
  if (!supabase) return res.status(401).json({ error: 'Missing bearer token' })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) return res.status(401).json({ error: 'Invalid session' })
  const userId = userData.user.id

  // Gather profile + macrocycle (RLS scopes both to this user).
  const { data: profile } = await supabase
    .from('profiles')
    .select('playstyle, us_squash_rating, level_descriptor, days_per_week, avg_session_min, has_partner_default, gym_access, goal_type, injuries')
    .eq('id', userId)
    .single()
  if (!profile) return res.status(400).json({ error: 'Complete onboarding first' })

  const { data: macroRow } = await supabase
    .from('macrocycles')
    .select('start_date, end_date, block_type, phases')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const weekStart = startOfWeekISO(new Date().toISOString().slice(0, 10))
  const phase = macroRow ? currentPhase(macroRow as Macrocycle, weekStart).name : 'General Prep'

  // Last-week history (best effort; empty on first run / errors).
  const lastWeekStart = addWeeks(weekStart, -1)
  let lastWeek = { planned: 0, completed: 0, rpeTrend: 'n/a', journalThemes: 'n/a' }
  try {
    const { data: prevPlan } = await supabase
      .from('weekly_plans').select('id').eq('user_id', userId).eq('week_start', lastWeekStart).maybeSingle()
    if (prevPlan) {
      const { count: planned } = await supabase
        .from('sessions').select('id', { count: 'exact', head: true }).eq('weekly_plan_id', prevPlan.id)
      const { data: done } = await supabase
        .from('completed_sessions').select('actual_rpe').eq('user_id', userId).gte('date', lastWeekStart).lt('date', weekStart)
      const rpes = (done ?? []).map((d) => d.actual_rpe).filter((n): n is number => n != null)
      lastWeek = {
        planned: planned ?? 0,
        completed: done?.length ?? 0,
        rpeTrend: rpes.length ? `avg ${(rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1)}` : 'n/a',
        journalThemes: 'n/a',
      }
    }
  } catch {
    // non-fatal
  }

  // Generate via LLM; fall back to the deterministic template on any failure.
  let plan: WeeklyPlan
  let source: 'llm' | 'fallback' = 'llm'
  let raw: string | null = null
  try {
    const messages = buildWeeklyMessages({
      profile: { ...profile, injuries: (profile.injuries as string[]) ?? [] },
      phase, weekStart, lastWeek,
    })
    const json = await callGroqJSON(messages)
    raw = JSON.stringify(json)
    plan = WeeklyPlanSchema.parse(json)
  } catch (e) {
    source = 'fallback'
    raw = e instanceof Error ? e.message : String(e)
    plan = buildTemplateWeek(phase, profile.days_per_week ?? 3, profile.avg_session_min ?? 60)
  }

  // Persist: replace any existing plan for this week (cascade drops its sessions), then insert.
  await supabase.from('weekly_plans').delete().eq('user_id', userId).eq('week_start', weekStart)
  const { data: planRow, error: planErr } = await supabase
    .from('weekly_plans')
    .insert({
      user_id: userId,
      macrocycle_id: null,
      week_start: weekStart,
      phase,
      rationale: plan.rationale,
      status: 'active',
      generated_by: source,
    })
    .select('id')
    .single()
  if (planErr || !planRow) return res.status(500).json({ error: 'Failed to save plan' })

  const rows = plan.sessions.map((s, i) => ({
    user_id: userId,
    weekly_plan_id: planRow.id,
    day: new Date(Date.parse(weekStart) + s.day_index * 86_400_000).toISOString().slice(0, 10),
    type: s.type,
    focus: s.focus,
    duration_min: s.duration_min,
    target_rpe: s.target_rpe,
    detail: s.detail,
    order_index: i,
  }))
  const { error: sessErr } = await supabase.from('sessions').insert(rows)
  if (sessErr) return res.status(500).json({ error: 'Failed to save sessions' })

  // Log the decision (best effort).
  await supabase.from('llm_logs').insert({
    user_id: userId,
    call_type: 'weekly',
    input_summary: { phase, weekStart, days: profile.days_per_week },
    raw_response: raw,
    parsed: plan,
    status: source === 'llm' ? 'ok' : 'fallback',
  })

  return res.status(200).json({ ok: true, source, plan_id: planRow.id, phase, week_start: weekStart })
}
```

- [ ] **Step 2: Build check** — `npm run build` (app build must remain green; `api/` is excluded from the app tsconfig). Commit — `git add -A && git commit -m "feat: /api/generate-week handler (LLM + fallback + persist + log)"`

---

## Task 6: Client plan helpers

**Files:** Create `src/lib/plans.ts`

- [ ] **Step 1: Implement `src/lib/plans.ts`**

```ts
import { supabase } from './supabase'
import { startOfWeekISO } from './week'
import { todayISO } from './dates'

export interface SessionRow {
  id: string
  day: string
  type: 'oncourt' | 'strength' | 'cardio' | 'rest'
  focus: string | null
  duration_min: number | null
  target_rpe: number | null
  detail: Record<string, unknown>
  order_index: number
}
export interface WeekPlan {
  id: string
  week_start: string
  phase: string | null
  rationale: string | null
  generated_by: string
  sessions: SessionRow[]
}

/** Load the plan for the current week (or null if none yet). */
export async function loadCurrentWeek(userId: string): Promise<WeekPlan | null> {
  const weekStart = startOfWeekISO(todayISO())
  const { data: plan } = await supabase
    .from('weekly_plans')
    .select('id, week_start, phase, rationale, generated_by')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle()
  if (!plan) return null
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, day, type, focus, duration_min, target_rpe, detail, order_index')
    .eq('weekly_plan_id', plan.id)
    .order('order_index', { ascending: true })
  return { ...plan, sessions: (sessions as SessionRow[]) ?? [] }
}

/** Call the serverless generator with the user's access token. */
export async function generateWeek(): Promise<{ ok: boolean; source?: string; error?: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { ok: false, error: 'Not signed in' }
  const res = await fetch('/api/generate-week', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: body.error ?? `Server error ${res.status}` }
  return { ok: true, source: body.source }
}

/** Manual edit of a single planned session. */
export async function updateSession(id: string, patch: Partial<Pick<SessionRow, 'focus' | 'duration_min' | 'target_rpe' | 'type'>>): Promise<void> {
  const { error } = await supabase.from('sessions').update(patch).eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Build check** — `npm run build`. Commit — `git add -A && git commit -m "feat: client plan helpers"`

---

## Task 7: `/week` page — render, generate/re-plan, edit

**Files:** Rewrite `src/pages/Week.tsx`

- [ ] **Step 1: Implement `src/pages/Week.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useSession } from '../auth/useSession'
import { loadCurrentWeek, generateWeek, updateSession, type WeekPlan, type SessionRow } from '../lib/plans'
import { Button, Card, Input, Field } from '../components/ui'

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

          {s.detail && Object.keys(s.detail).length > 0 && (
            <pre className="mt-3 overflow-x-auto rounded-lg bg-surface-2 p-3 text-xs text-muted">
              {JSON.stringify(s.detail, null, 2)}
            </pre>
          )}

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

  async function save() {
    setSaving(true)
    await updateSession(session.id, {
      focus,
      duration_min: duration === '' ? null : Number(duration),
      target_rpe: rpe === '' ? null : Number(rpe),
    })
    setSaving(false)
    onSaved()
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
      <div><Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save session'}</Button></div>
    </div>
  )
}
```

- [ ] **Step 2: Build + test** — `npm run build` and `npm test` (all suites pass). Commit — `git add -A && git commit -m "feat: /week page — render plan, generate/re-plan, edit session"`

---

## Task 8 (CHECKPOINT — interactive with Corey): Groq + Vercel wiring, real end-to-end test

- [ ] **Step 1: Corey gets a Groq key** at https://console.groq.com/keys (free, no card). Corey adds `GROQ_API_KEY=...` and `GROQ_MODEL=llama-3.3-70b-versatile` to `~/squash-coach/.env.local`.
- [ ] **Step 2: Install + login Vercel CLI** — Claude runs `npm i -g vercel` (or `npx vercel`); Corey runs `vercel login` (Claude does not enter credentials). Then `vercel link` to create/link the project.
- [ ] **Step 3: Run `vercel dev`** (serves both the SPA and `/api`). Confirm it boots and picks up `.env.local`.
- [ ] **Step 4: Drive the app** — sign in, open `/week`, click “Generate plan”. Verify: a plan renders with a rationale and the right number of sessions for Corey's days/week, `generated_by` shows LLM (not fallback), and rows landed in `weekly_plans` + `sessions` + `llm_logs` (check Table Editor).
- [ ] **Step 5: Force the fallback path** — temporarily set a bad `GROQ_API_KEY`, re-plan, confirm the template plan renders with the “offline template” note and `llm_logs.status = 'fallback'`. Restore the key.
- [ ] **Step 6: Edit a session** — change focus/duration/RPE, save, confirm it persists after reload.
- [ ] **Step 7: Screenshot** the generated week; share with Corey.
- [ ] **Step 8:** Set `GROQ_API_KEY` + `GROQ_MODEL` in the Vercel project env (dashboard) for deploys. Merge `phase-2-weekly-plan` into `main`.

---

## Definition of Done (Phase 2)

- `npm run build` + `npm test` pass (week/schema/template suites added, all prior green).
- `/api/generate-week` authenticates via the caller's JWT (RLS-bound), calls Groq in JSON mode, validates with Zod, and falls back to the deterministic template on any failure — never returning broken output.
- Generating persists `weekly_plans` + `sessions` and logs to `llm_logs`; re-planning replaces the current week cleanly.
- `/week` shows the phase, rationale, per-day sessions with focus/duration/RPE/detail, a generate/re-plan button, and per-session manual edit that persists.
- Real Groq call verified end-to-end via `vercel dev`, and the fallback path verified by simulating an LLM failure.
