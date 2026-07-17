# Squash Coach — Design Spec

**Date:** 2026-07-17
**Status:** Approved design, pre-implementation
**Author:** Corey Shen (with Claude)

A single-user, adaptive squash training app that behaves like a coach: it builds a
periodized training block, generates a personalized plan each week, and every day
reads your recovery signals + journal to decide whether today's session stays, scales,
changes type, or becomes rest.

---

## 1. Decisions locked in brainstorming

- **Infra/keys:** Corey owns the Supabase project, Gemini API key, and Vercel project.
  Claude builds the app and walks Corey through each external setup step live. Claude
  never enters credentials or creates accounts.
- **Build cadence:** Per-phase checkpoints — a working, verifiable slice at each phase
  boundary before moving on.
- **Auth scope:** Single user for v1, but RLS is written correctly (`user_id` scoping)
  so adding a training partner later is a data change, not a rewrite.
- **Wearables:** Manual entry via a clean check-in form for v1, with a stubbed import
  hook (endpoint + schema shape) so a real sync can slot in later.
- **Accent color:** Warm amber (~`#E8A13A`) against a deep navy/charcoal base.

## 2. Architecture

```
React (Vite + TS) SPA  ──►  Vercel Serverless Functions (/api/*)  ──►  Gemini API
        │                            │  (GEMINI_API_KEY server-only)
        └──────────► Supabase (Postgres + Auth + RLS) ◄──────────┘
```

- **Frontend:** React + Vite + TypeScript, React Router, TanStack Query (server state),
  Tailwind + a thin custom design-token layer, Framer Motion for restrained
  micro-interactions.
- **Server-side LLM:** two Vercel serverless functions (`/api/*`). Each reads the
  caller's Supabase access token from the `Authorization` header, creates a per-request
  Supabase client bound to that token so **RLS is enforced even server-side**, fetches
  the data it needs, builds the prompt, calls Gemini with a strict JSON response schema,
  validates with Zod, writes results back, logs the decision, and returns to the client.
- **`GEMINI_API_KEY`** lives only in Vercel environment variables — never in client code,
  never committed.
- **Model:** `gemini-2.5-flash` on the free AI Studio tier (confirm current free
  model + limits at build time). ~8 calls/week is far below quota.

## 3. LLM integration (the coaching brain)

### Call 1 — Weekly plan generation (`POST /api/generate-week`)
Runs on a new week or an explicit re-plan request (not on page load).
- **Inputs:** full profile, current macrocycle phase, last week's planned-vs-completed
  sessions, RPE trend, recent journal themes.
- **Output (strict JSON):** `{ rationale, sessions: [{ day, type, focus, duration_min,
  target_rpe, detail }] }` where `type ∈ {oncourt, strength, cardio, rest}`.
- **Fallback:** on API failure or schema-invalid output, keep last week's plan (or a
  phase-appropriate template) and flag `generated_by: fallback`. Never show broken output.

### Call 2 — Daily check-in interpretation (`POST /api/checkin`)
Runs after a check-in is submitted.
- **Guardrails run FIRST, server-side, before Gemini:**
  1. Journal text matches injury/pain keywords (e.g. "pain", "sharp", "tweaked",
     "strain", "pulled", "injured") → force **rest**.
  2. Wearable extreme outlier vs. baseline (RHR ≫ baseline, HRV ≪ baseline, sleep < 4h)
     → force **rest**.
  If a guardrail fires, skip Gemini, return a rule-based rest decision, still log it.
- **Inputs (if no guardrail fired):** today's planned session, wearable deltas vs. the
  user's own 7-day rolling baseline (HRV, RHR, sleep), yesterday's RPE, today's
  availability (partner/court/minutes), journal text.
- **Output (strict JSON):** `{ decision: keep|scale_down|scale_up|change_modality|rest,
  rationale, adjusted_session? }`. `adjusted_session` required unless `keep`.
- **Fallback:** on failure, keep the planned session unchanged, flagged, logged.

### Macrocycle generation — deterministic (not LLM)
Rule-based periodization from the goal date (or a rolling 8–12 week block if no date),
split into phases: (1) general prep, (2) specific prep, (3) pre-competitive/power,
(4) competition/maintenance. Reliable and free; the LLM reasons *within* the current
phase each week.

### System prompt
Built from the squash coaching knowledge in the brief (periodization phases, three
training types, RPE-based intensity, solo/ghosting substitution logic) + the user's
current profile, so reasoning is squash-specific, not generic fitness advice.

## 4. Data model (Supabase, RLS by `user_id` from day one)

- **`profiles`** (PK = auth uid) — playstyle, us_squash_rating (nullable), level_descriptor,
  years_playing, weekly_oncourt_hours, strength_experience, days_per_week, avg_session_min,
  schedule_flexibility, has_partner_default, gym_access (full/bodyweight/none), goal_type,
  goal_target_date, injuries (jsonb), onboarding_complete.
- **`macrocycles`** — user_id, start_date, end_date (nullable), block_type
  (fixed-goal/rolling), phases (jsonb: ordered `{name, start_week, end_week}`).
- **`weekly_plans`** — user_id, macrocycle_id, week_start, phase, rationale, status
  (active/superseded), generated_by (llm/fallback/manual).
- **`sessions`** (planned) — user_id, weekly_plan_id, day, type (oncourt/strength/cardio/
  rest), focus, duration_min, target_rpe, detail (jsonb), solo_focus_tag
  (movement/fitness/touch/mixed), order_index.
- **`daily_checkins`** — user_id, date, resting_hr, hrv, sleep_hours, sleep_quality,
  yesterday_rpe, partner_available, court_available, minutes_available,
  hrv_delta, rhr_delta, sleep_delta, acwr.
- **`journal_entries`** — user_id, date, checkin_id (nullable), body, tags (jsonb),
  full-text search index. Standalone reviewable diary.
- **`completed_sessions`** — user_id, session_id (nullable), date, actual_type,
  actual_duration, actual_rpe, adjustment (keep/scale_down/scale_up/change_modality/rest),
  adjustment_reason, notes.
- **`solo_drill_library`** — focus tag (movement/fitness/touch/mixed), name, structure
  (jsonb), target_intensity, duration_min, equivalent_for. **Global read-only reference,
  seeded via migration.** Makes solo substitution deterministic.
- **`llm_logs`** — user_id, call_type (weekly/daily), input_summary (jsonb), raw_response,
  parsed (jsonb), status (ok/fallback/error), created_at.

**Baseline math (server-side, stored on the check-in row):** 7-day rolling averages for
HRV/RHR/sleep; ACWR = 7-day load ÷ 28-day avg load, where session load ≈ duration × RPE.
Transparent and unit-testable.

## 5. Solo / no-partner substitution
When a session is `oncourt` and the user marks "no partner today," swap in an equivalent
drill from `solo_drill_library` matched on `solo_focus_tag` (movement/fitness/touch/mixed)
and target intensity — deterministic, not improvised. Library seeded with ghosting patterns
(6-corner star, figure-eight, front/back circuits), solo hitting/wall drills (rails,
repeated drops, boast-and-drive), and time-trials (e.g. 120-shot shadow drill).

## 6. Pages (mobile-first; bottom tab bar on phone, side nav on desktop)
- `/login`
- `/onboarding` — multi-step, gates the app until complete.
- **`/` Today** — daily check-in → decision card with visible rationale → today's session
  detail with "no partner today" solo swap.
- **`/week`** — this week's plan, re-plan button, manual edit/override of any session.
- **`/journal`** — searchable training diary.
- **`/progress`** — completed-vs-planned, adjustment count + reasons, RPE trend, journal
  themes, periodic rating update.
- **`/profile`** — edit onboarding data, rating, goals, injuries.

## 7. Design system
Dark-first, calm athletic. Navy/charcoal base + single warm-amber accent, generous
whitespace, one strong type scale, small custom primitives (Button, Card, Input, Stepper,
StatTile, DecisionCard, SessionCard) reused across every screen — no per-page restyling.
Design tokens defined once as CSS variables + Tailwind theme extension.

## 8. Testing
Vitest on the deterministic core: baseline/ACWR math, guardrail keyword + outlier logic,
JSON schema validation, solo-substitution mapping. Gemini mocked in tests. Light component
tests on the check-in flow.

## 9. Build sequence (each phase ends in a working, verifiable slice)
0. Scaffold + design system + Supabase schema/migrations/RLS + auth.
1. Onboarding + deterministic macrocycle generation.
2. Weekly plan generator (LLM call 1 + fallback).
3. Daily check-in flow + baseline math + solo substitution.
4. Adaptive logic (LLM call 2 + guardrails).
5. Progress + journal + review.

## 10. Explicit non-goals for v1
- Real wearable OAuth sync (stub the import hook only).
- Coach/athlete roles and sharing UI (RLS is ready; UI is not built).
- Native mobile app (responsive web only).
- Multi-sport support.
