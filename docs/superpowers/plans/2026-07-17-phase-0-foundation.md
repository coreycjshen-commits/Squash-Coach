# Squash Coach — Phase 0: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Squash Coach app skeleton — Vite/React/TS frontend with the navy/amber design system, a fully-provisioned Supabase database with correct RLS, and working email auth that gates the app behind login + an onboarding check.

**Architecture:** React SPA (Vite) talking to Supabase for auth + data. All app data tables are RLS-scoped to `auth.uid()` from day one; the drill library is global read-only reference. A `SessionProvider` exposes auth state; a `<Protected>` guard redirects unauthenticated users to `/login` and users without a completed profile to `/onboarding`. Serverless `/api/*` functions are stubbed but not yet implemented (Phase 2+).

**Tech Stack:** Vite, React 18, TypeScript, React Router v6, TanStack Query, Tailwind CSS, Framer Motion, `@supabase/supabase-js`, Vitest + Testing Library, Zod.

---

## Phase Roadmap (context — only Phase 0 is planned in detail below)

- **Phase 0 — Foundation (this plan):** scaffold, design system, full DB schema + RLS + drill seed, auth + route guards, app shell.
- **Phase 1 — Onboarding + macrocycle:** multi-step onboarding form → `profiles` row + deterministic periodized `macrocycles`.
- **Phase 2 — Weekly plan generator:** `/api/generate-week` Gemini call + Zod validation + fallback + `/week` view.
- **Phase 3 — Daily check-in + baseline + solo swap:** check-in form, server-side 7-day baseline/ACWR math, deterministic solo substitution.
- **Phase 4 — Adaptive logic:** `/api/checkin` guardrails-first + Gemini interpretation + decision card.
- **Phase 5 — Progress + journal:** weekly summary, RPE trend, searchable diary, rating recalibration.

---

## File Structure (Phase 0)

```
squash-coach/
├── api/                              # Vercel serverless (stubs only this phase)
│   └── health.ts                     # trivial endpoint to prove /api routing on Vercel
├── supabase/
│   ├── migrations/
│   │   └── 0001_initial_schema.sql   # ALL tables + RLS + enums
│   └── seed.sql                      # solo_drill_library seed rows
├── src/
│   ├── main.tsx                      # app entry: providers + router
│   ├── App.tsx                       # route table
│   ├── index.css                     # Tailwind directives + design tokens (CSS vars)
│   ├── lib/
│   │   └── supabase.ts               # browser Supabase client (anon key)
│   ├── auth/
│   │   ├── SessionProvider.tsx       # auth context: session, profile, loading
│   │   ├── useSession.ts             # hook to read the context
│   │   └── Protected.tsx             # route guard (auth + onboarding gate)
│   ├── components/ui/                # design-system primitives
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   └── index.ts
│   ├── components/AppShell.tsx       # nav chrome (bottom tabs / side nav)
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Today.tsx                 # placeholder
│   │   ├── Week.tsx                  # placeholder
│   │   ├── Journal.tsx               # placeholder
│   │   ├── Progress.tsx              # placeholder
│   │   ├── Profile.tsx               # placeholder
│   │   └── Onboarding.tsx            # placeholder
│   └── test/
│       └── setup.ts                  # Vitest + jsdom + jest-dom setup
├── .env.local.example                # documents required env vars (committed)
├── .env.local                        # real keys (gitignored, created live with Corey)
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts                    # Vite + Vitest config
├── tailwind.config.ts
├── postcss.config.js
└── vercel.json                       # SPA rewrite so client routes work on Vercel
```

---

## Task 1: Scaffold the Vite + React + TS project

**Files:**
- Create: `package.json`, `tsconfig.json`, `tsconfig.node.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/vite-env.d.ts`

- [ ] **Step 1: Scaffold with the Vite React-TS template into the current dir**

Run (from `/Users/coreyshen/squash-coach`, which already has the git repo + docs):
```bash
npm create vite@latest . -- --template react-ts
```
If prompted about the non-empty directory, choose **"Ignore files and continue"** (it will not touch `docs/`, `.git/`, or `.gitignore`).

- [ ] **Step 2: Install base dependencies**

```bash
npm install react-router-dom @tanstack/react-query @supabase/supabase-js zod framer-motion
npm install -D tailwindcss@^3 postcss autoprefixer vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @types/node
```

- [ ] **Step 3: Verify it boots**

Run: `npm run dev` (then Ctrl-C). Expected: Vite prints a `localhost:5173` URL with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite React-TS project"
```

---

## Task 2: Configure Tailwind + design tokens (navy/charcoal + amber)

**Files:**
- Create: `tailwind.config.ts`, `postcss.config.js`
- Modify: `src/index.css` (replace contents)

- [ ] **Step 1: Create `postcss.config.js`**

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 2: Create `tailwind.config.ts`**

```ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        surface: 'rgb(var(--surface) / <alpha-value>)',
        'surface-2': 'rgb(var(--surface-2) / <alpha-value>)',
        border: 'rgb(var(--border) / <alpha-value>)',
        text: 'rgb(var(--text) / <alpha-value>)',
        muted: 'rgb(var(--muted) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-fg': 'rgb(var(--accent-fg) / <alpha-value>)',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.25rem',
      },
    },
  },
  plugins: [],
} satisfies Config
```

- [ ] **Step 3: Replace `src/index.css` with tokens + base styles**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* deep navy / charcoal base, warm amber accent — values are R G B */
  --bg: 11 18 32;          /* #0B1220 */
  --surface: 17 25 42;     /* #11192A */
  --surface-2: 24 34 54;   /* #182236 */
  --border: 38 50 74;      /* #26324A */
  --text: 232 237 245;     /* #E8EDF5 */
  --muted: 148 163 184;    /* #94A3B8 */
  --accent: 232 161 58;    /* #E8A13A amber */
  --accent-fg: 20 14 4;    /* near-black text on amber */
}

html, body, #root { height: 100%; }

body {
  @apply bg-bg text-text font-sans antialiased;
  font-feature-settings: 'cv11', 'ss01';
}

/* respect users who prefer reduced motion */
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 4: Add the Inter font link to `index.html`**

In `<head>` of `index.html`, add:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 5: Verify tokens render**

Temporarily set `src/App.tsx` to:
```tsx
export default function App() {
  return (
    <div className="min-h-full grid place-items-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">Squash Coach</h1>
      <button className="rounded-xl bg-accent px-4 py-2 font-medium text-accent-fg">
        Amber on navy
      </button>
    </div>
  )
}
```
Run `npm run dev`, open the URL: expect dark navy background, light text, an amber button. Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: tailwind + navy/amber design tokens"
```

---

## Task 3: Design-system primitives (Button, Card, Input)

**Files:**
- Create: `src/components/ui/Button.tsx`, `src/components/ui/Card.tsx`, `src/components/ui/Input.tsx`, `src/components/ui/index.ts`

- [ ] **Step 1: Create `src/components/ui/Button.tsx`**

```tsx
import { forwardRef, type ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

const styles: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:brightness-110 active:brightness-95',
  secondary: 'bg-surface-2 text-text hover:bg-border',
  ghost: 'bg-transparent text-muted hover:text-text',
}

export const Button = forwardRef<HTMLButtonElement, Props>(
  ({ variant = 'primary', className = '', ...rest }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold
        transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[variant]} ${className}`}
      {...rest}
    />
  ),
)
Button.displayName = 'Button'
```

- [ ] **Step 2: Create `src/components/ui/Card.tsx`**

```tsx
import type { HTMLAttributes } from 'react'

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface p-5 shadow-sm ${className}`}
      {...rest}
    />
  )
}
```

- [ ] **Step 3: Create `src/components/ui/Input.tsx`**

```tsx
import { forwardRef, type InputHTMLAttributes } from 'react'

interface Props extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
}

export const Input = forwardRef<HTMLInputElement, Props>(
  ({ label, id, className = '', ...rest }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-muted">
          {label}
        </label>
      )}
      <input
        id={id}
        ref={ref}
        className={`rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-text
          placeholder:text-muted/60 outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 ${className}`}
        {...rest}
      />
    </div>
  ),
)
Input.displayName = 'Input'
```

- [ ] **Step 4: Create `src/components/ui/index.ts`**

```ts
export { Button } from './Button'
export { Card } from './Card'
export { Input } from './Input'
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: base UI primitives (Button, Card, Input)"
```

---

## Task 4: Full Supabase schema + RLS migration

**Files:**
- Create: `supabase/migrations/0001_initial_schema.sql`

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/0001_initial_schema.sql`:

```sql
-- ============ ENUMS ============
create type session_type as enum ('oncourt', 'strength', 'cardio', 'rest');
create type gym_access as enum ('full', 'bodyweight', 'none');
create type playstyle as enum ('attacking', 'retrieving', 'all_court');
create type block_type as enum ('fixed_goal', 'rolling');
create type plan_source as enum ('llm', 'fallback', 'manual');
create type plan_status as enum ('active', 'superseded');
create type solo_focus as enum ('movement', 'fitness', 'touch', 'mixed');
create type adjustment as enum ('keep', 'scale_down', 'scale_up', 'change_modality', 'rest');
create type llm_call_type as enum ('weekly', 'daily');
create type llm_status as enum ('ok', 'fallback', 'error');

-- ============ PROFILES ============
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  playstyle playstyle,
  us_squash_rating numeric(3,1),
  level_descriptor text,
  years_playing numeric(4,1),
  weekly_oncourt_hours numeric(4,1),
  strength_experience text,
  days_per_week int check (days_per_week between 1 and 7),
  avg_session_min int,
  schedule_flexibility text,          -- 'fixed' | 'flexible'
  has_partner_default boolean default true,
  gym_access gym_access default 'full',
  goal_type text,
  goal_target_date date,
  injuries jsonb default '[]'::jsonb,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============ MACROCYCLES ============
create table macrocycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  start_date date not null,
  end_date date,
  block_type block_type not null,
  phases jsonb not null default '[]'::jsonb,   -- [{name,start_week,end_week}]
  created_at timestamptz not null default now()
);

-- ============ WEEKLY PLANS ============
create table weekly_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  macrocycle_id uuid references macrocycles(id) on delete set null,
  week_start date not null,
  phase text,
  rationale text,
  status plan_status not null default 'active',
  generated_by plan_source not null default 'llm',
  created_at timestamptz not null default now(),
  unique (user_id, week_start)
);

-- ============ SESSIONS (planned) ============
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekly_plan_id uuid not null references weekly_plans(id) on delete cascade,
  day date not null,
  type session_type not null,
  focus text,
  duration_min int,
  target_rpe int check (target_rpe between 1 and 10),
  detail jsonb default '{}'::jsonb,
  solo_focus_tag solo_focus,
  order_index int not null default 0,
  created_at timestamptz not null default now()
);

-- ============ DAILY CHECK-INS ============
create table daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  resting_hr int,
  hrv int,
  sleep_hours numeric(3,1),
  sleep_quality int check (sleep_quality between 1 and 5),
  yesterday_rpe int check (yesterday_rpe between 1 and 10),
  partner_available boolean,
  court_available boolean,
  minutes_available int,
  hrv_delta numeric,
  rhr_delta numeric,
  sleep_delta numeric,
  acwr numeric,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ============ JOURNAL ENTRIES ============
create table journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  checkin_id uuid references daily_checkins(id) on delete set null,
  body text not null default '',
  tags jsonb default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index journal_body_fts on journal_entries using gin (to_tsvector('english', body));

-- ============ COMPLETED SESSIONS ============
create table completed_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  date date not null,
  actual_type session_type,
  actual_duration int,
  actual_rpe int check (actual_rpe between 1 and 10),
  adjustment adjustment,
  adjustment_reason text,
  notes text,
  created_at timestamptz not null default now()
);

-- ============ SOLO DRILL LIBRARY (global reference) ============
create table solo_drill_library (
  id uuid primary key default gen_random_uuid(),
  focus solo_focus not null,
  name text not null,
  structure jsonb not null default '{}'::jsonb,
  target_intensity int check (target_intensity between 1 and 10),
  duration_min int,
  equivalent_for session_type not null default 'oncourt'
);

-- ============ LLM LOGS ============
create table llm_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  call_type llm_call_type not null,
  input_summary jsonb,
  raw_response text,
  parsed jsonb,
  status llm_status not null,
  created_at timestamptz not null default now()
);

-- ============ updated_at trigger for profiles ============
create or replace function set_updated_at() returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ============ auto-create profile row on signup ============
create or replace function handle_new_user() returns trigger as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ============ ROW LEVEL SECURITY ============
alter table profiles            enable row level security;
alter table macrocycles         enable row level security;
alter table weekly_plans        enable row level security;
alter table sessions            enable row level security;
alter table daily_checkins      enable row level security;
alter table journal_entries     enable row level security;
alter table completed_sessions  enable row level security;
alter table llm_logs            enable row level security;
alter table solo_drill_library  enable row level security;

-- profiles: owner is row id
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);

-- helper macro pattern: each user-owned table scoped to user_id
create policy "macrocycles_all_own" on macrocycles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "weekly_plans_all_own" on weekly_plans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "sessions_all_own" on sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_checkins_all_own" on daily_checkins
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "journal_entries_all_own" on journal_entries
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "completed_sessions_all_own" on completed_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "llm_logs_all_own" on llm_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- solo_drill_library: readable by any authenticated user, no writes from clients
create policy "solo_drills_read_all" on solo_drill_library
  for select using (auth.role() = 'authenticated');
```

- [ ] **Step 2: Sanity-check SQL syntax locally (no DB needed)**

This is a static file; there is no local step that compiles it without a Postgres instance. It will be validated when applied in Task 8. Do NOT block here.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: initial Supabase schema + RLS migration"
```

---

## Task 5: Solo drill library seed

**Files:**
- Create: `supabase/seed.sql`

- [ ] **Step 1: Write the seed**

Create `supabase/seed.sql`:

```sql
insert into solo_drill_library (focus, name, structure, target_intensity, duration_min, equivalent_for) values
('movement', '6-Corner Star Ghosting',
  '{"pattern":"center to each of 6 court corners and back","sets":4,"work_sec":45,"rest_sec":75}'::jsonb, 8, 30, 'oncourt'),
('movement', 'Figure-Eight Rhythm Ghosting',
  '{"pattern":"front-corner to opposite back-corner looping figure-8","sets":5,"work_sec":40,"rest_sec":60}'::jsonb, 7, 25, 'oncourt'),
('movement', 'Front/Back Ghosting Circuit',
  '{"pattern":"short front drop lunge then deep back-corner drive","sets":6,"work_sec":30,"rest_sec":45}'::jsonb, 7, 25, 'oncourt'),
('touch', 'Solo Rail Hitting',
  '{"pattern":"straight-drive rails down both walls, target back third","reps":200,"target":"length past service line"}'::jsonb, 5, 30, 'oncourt'),
('touch', 'Repeated Drops',
  '{"pattern":"soft straight + cross drops off own feed","sets":8,"reps":15}'::jsonb, 4, 25, 'oncourt'),
('touch', 'Boast-and-Drive Combo (solo)',
  '{"pattern":"boast, run to front, straight drive, reset","sets":6,"reps":10}'::jsonb, 6, 30, 'oncourt'),
('fitness', '120-Shot Solo Shadow Drill',
  '{"pattern":"continuous shadow swings across all corners","total_shots":120,"target_time_min":8}'::jsonb, 9, 20, 'oncourt'),
('fitness', 'Court Sprint Intervals',
  '{"pattern":"baseline-to-front-wall sprints","sets":10,"work_sec":15,"rest_sec":45}'::jsonb, 9, 25, 'cardio'),
('mixed', 'Ghost + Hit Pyramid',
  '{"pattern":"alternate 1 min ghosting / 1 min rail hitting, ladder 1-2-3-2-1","rounds":9}'::jsonb, 7, 35, 'oncourt');
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: seed solo drill library"
```

---

## Task 6: Supabase browser client + env vars

**Files:**
- Create: `src/lib/supabase.ts`, `.env.local.example`, `src/vite-env.d.ts` (modify if exists)

- [ ] **Step 1: Create `.env.local.example` (committed, documents required vars)**

```
# Frontend (safe to expose — anon key is public by design, protected by RLS)
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Server-only (set in Vercel env, used by /api functions in later phases) — DO NOT prefix with VITE_
GEMINI_API_KEY=set-in-vercel-only
```

- [ ] **Step 2: Add typed env to `src/vite-env.d.ts`**

Replace the file contents with:
```ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

- [ ] **Step 3: Create `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Missing Supabase env vars. Copy .env.local.example to .env.local and fill in your project URL + anon key.',
  )
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: supabase browser client + env scaffolding"
```

---

## Task 7: Vitest setup + a real test for the onboarding-gate logic

We extract the redirect decision into a pure function so it is unit-testable without rendering routers. TDD applies here.

**Files:**
- Create: `vite.config.ts` (modify existing to add test config), `src/test/setup.ts`, `src/auth/gate.ts`, `src/auth/gate.test.ts`

- [ ] **Step 1: Update `vite.config.ts` to add Vitest config**

Replace with:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
})
```

- [ ] **Step 2: Create `src/test/setup.ts`**

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 3: Write the failing test — `src/auth/gate.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { resolveGate } from './gate'

describe('resolveGate', () => {
  it('sends unauthenticated users to /login', () => {
    expect(resolveGate({ hasSession: false, onboardingComplete: false, path: '/' }))
      .toEqual({ redirect: '/login' })
  })

  it('sends authed-but-not-onboarded users to /onboarding', () => {
    expect(resolveGate({ hasSession: true, onboardingComplete: false, path: '/' }))
      .toEqual({ redirect: '/onboarding' })
  })

  it('lets an onboarded user through', () => {
    expect(resolveGate({ hasSession: true, onboardingComplete: true, path: '/' }))
      .toEqual({ redirect: null })
  })

  it('does not loop: an un-onboarded user already on /onboarding is allowed', () => {
    expect(resolveGate({ hasSession: true, onboardingComplete: false, path: '/onboarding' }))
      .toEqual({ redirect: null })
  })

  it('bounces an onboarded user off /onboarding back to home', () => {
    expect(resolveGate({ hasSession: true, onboardingComplete: true, path: '/onboarding' }))
      .toEqual({ redirect: '/' })
  })
})
```

- [ ] **Step 4: Run the test, verify it fails**

Run: `npx vitest run src/auth/gate.test.ts`
Expected: FAIL — cannot resolve `./gate` / `resolveGate is not a function`.

- [ ] **Step 5: Implement `src/auth/gate.ts`**

```ts
export interface GateInput {
  hasSession: boolean
  onboardingComplete: boolean
  path: string
}
export interface GateResult {
  redirect: string | null
}

export function resolveGate({ hasSession, onboardingComplete, path }: GateInput): GateResult {
  if (!hasSession) return { redirect: '/login' }
  if (!onboardingComplete) {
    return { redirect: path === '/onboarding' ? null : '/onboarding' }
  }
  // onboarded: keep them out of the onboarding flow
  if (path === '/onboarding') return { redirect: '/' }
  return { redirect: null }
}
```

- [ ] **Step 6: Run the test, verify it passes**

Run: `npx vitest run src/auth/gate.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 7: Add test script to `package.json`**

In `package.json` `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: onboarding gate logic + vitest setup (TDD)"
```

---

## Task 8 (CHECKPOINT — interactive with Corey): Create Supabase project + apply schema

This is the live external-setup step. **Do not automate credential entry.** Walk Corey through it and wait.

- [ ] **Step 1: Corey creates the project**

Ask Corey to: sign in at supabase.com → New Project → name it `squash-coach`, choose a region near them, set a DB password (their password manager, not shared with Claude). Wait for the project to finish provisioning.

- [ ] **Step 2: Corey applies the schema + seed**

Guide Corey to Supabase dashboard → SQL Editor → paste the contents of `supabase/migrations/0001_initial_schema.sql`, run it. Then paste `supabase/seed.sql`, run it. Confirm no errors (fix any surfaced SQL errors in the migration file, re-commit, re-run).

Alternative offered if Corey has the Supabase CLI + Docker: `supabase link` then `supabase db push` + `supabase db seed`.

- [ ] **Step 3: Corey pastes the two frontend keys**

From Supabase dashboard → Project Settings → API: copy the Project URL and the `anon` `public` key. Corey creates `.env.local` (Claude provides the exact file shape from `.env.local.example`) and pastes the two `VITE_*` values. `GEMINI_API_KEY` is left for a later phase (set in Vercel, not needed for Phase 0).

- [ ] **Step 4: Verify the schema landed**

In Supabase → Table Editor, confirm all 9 tables exist and `solo_drill_library` has 9 rows. Confirm RLS is "Enabled" on every table (green shield).

- [ ] **Step 5: No commit** (`.env.local` is gitignored). Confirm `git status` shows `.env.local` untracked/ignored.

---

## Task 9: SessionProvider + useSession hook

**Files:**
- Create: `src/auth/SessionProvider.tsx`, `src/auth/useSession.ts`

- [ ] **Step 1: Create `src/auth/SessionProvider.tsx`**

```tsx
import { createContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface Profile {
  onboarding_complete: boolean
}

export interface SessionState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
}

// eslint-disable-next-line react-refresh/only-export-components
export const SessionContext = createContext<SessionState | undefined>(undefined)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('onboarding_complete')
      .eq('id', userId)
      .single()
    setProfile(data ?? { onboarding_complete: false })
  }

  async function refreshProfile() {
    if (session?.user) await loadProfile(session.user.id)
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      if (data.session?.user) await loadProfile(data.session.user.id)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s)
      if (s?.user) await loadProfile(s.user.id)
      else setProfile(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  return (
    <SessionContext.Provider value={{ session, profile, loading, refreshProfile }}>
      {children}
    </SessionContext.Provider>
  )
}
```

- [ ] **Step 2: Create `src/auth/useSession.ts`**

```ts
import { useContext } from 'react'
import { SessionContext } from './SessionProvider'

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: session provider + useSession hook"
```

---

## Task 10: Protected route guard wired to the gate

**Files:**
- Create: `src/auth/Protected.tsx`

- [ ] **Step 1: Create `src/auth/Protected.tsx`**

```tsx
import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from './useSession'
import { resolveGate } from './gate'

export function Protected({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useSession()
  const location = useLocation()

  if (loading) {
    return <div className="grid min-h-full place-items-center text-muted">Loading…</div>
  }

  const { redirect } = resolveGate({
    hasSession: !!session,
    onboardingComplete: !!profile?.onboarding_complete,
    path: location.pathname,
  })

  if (redirect && redirect !== location.pathname) {
    return <Navigate to={redirect} replace />
  }
  return <>{children}</>
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: Protected route guard"
```

---

## Task 11: Login page (email + password)

**Files:**
- Create: `src/pages/Login.tsx`

- [ ] **Step 1: Create `src/pages/Login.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button, Card, Input } from '../components/ui'

export default function Login() {
  const nav = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const fn =
      mode === 'signin'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })
    const { error } = await fn
    setBusy(false)
    if (error) return setError(error.message)
    nav('/', { replace: true })
  }

  return (
    <div className="grid min-h-full place-items-center p-6">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold">Squash Coach</h1>
        <p className="mb-6 text-sm text-muted">
          {mode === 'signin' ? 'Sign in to your training log.' : 'Create your account.'}
        </p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input
            id="email" label="Email" type="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required
          />
          <Input
            id="password" label="Password" type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </Button>
        </form>
        <button
          className="mt-4 text-sm text-muted hover:text-text"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "feat: login/signup page"
```

---

## Task 12: App shell (nav) + placeholder pages

**Files:**
- Create: `src/components/AppShell.tsx`, `src/pages/Today.tsx`, `src/pages/Week.tsx`, `src/pages/Journal.tsx`, `src/pages/Progress.tsx`, `src/pages/Profile.tsx`, `src/pages/Onboarding.tsx`

- [ ] **Step 1: Create the five main placeholder pages + onboarding placeholder**

Each of `Today.tsx`, `Week.tsx`, `Journal.tsx`, `Progress.tsx`, `Profile.tsx` follows this shape (substitute name + copy):
```tsx
import { Card } from '../components/ui'
export default function Today() {
  return (
    <Card>
      <h1 className="text-xl font-semibold">Today</h1>
      <p className="mt-2 text-sm text-muted">Daily check-in and today's session — coming in Phase 3.</p>
    </Card>
  )
}
```
Create the other four analogously (`Week` → "This week's plan — Phase 2", `Journal` → "Training diary — Phase 5", `Progress` → "Weekly review — Phase 5", `Profile` → "Your profile — Phase 1").

Create `src/pages/Onboarding.tsx`:
```tsx
import { Card } from '../components/ui'
export default function Onboarding() {
  return (
    <div className="grid min-h-full place-items-center p-6">
      <Card className="max-w-md">
        <h1 className="text-xl font-semibold">Onboarding</h1>
        <p className="mt-2 text-sm text-muted">Multi-step setup — coming in Phase 1.</p>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Create `src/components/AppShell.tsx`**

```tsx
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const tabs = [
  { to: '/', label: 'Today' },
  { to: '/week', label: 'Week' },
  { to: '/journal', label: 'Journal' },
  { to: '/progress', label: 'Progress' },
  { to: '/profile', label: 'Profile' },
]

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col md:flex-row">
      {/* Desktop side nav */}
      <aside className="hidden border-r border-border p-4 md:block md:w-48">
        <div className="mb-8 px-2 text-lg font-semibold">Squash Coach</div>
        <nav className="flex flex-col gap-1">
          {tabs.map((t) => (
            <NavItem key={t.to} {...t} />
          ))}
        </nav>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-8 px-2 text-sm text-muted hover:text-text"
        >
          Sign out
        </button>
      </aside>

      <main className="flex-1 p-4 pb-24 md:pb-4">{children}</main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-border bg-surface/95 py-2 backdrop-blur md:hidden">
        {tabs.map((t) => (
          <NavItem key={t.to} {...t} compact />
        ))}
      </nav>
    </div>
  )
}

function NavItem({ to, label, compact }: { to: string; label: string; compact?: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? 'text-accent' : 'text-muted hover:text-text'
        } ${compact ? 'text-center' : ''}`
      }
    >
      {label}
    </NavLink>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat: app shell nav + placeholder pages"
```

---

## Task 13: Wire router + providers in App.tsx and main.tsx

**Files:**
- Modify: `src/App.tsx`, `src/main.tsx`

- [ ] **Step 1: Replace `src/main.tsx`**

```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SessionProvider } from './auth/SessionProvider'
import App from './App'
import './index.css'

const queryClient = new QueryClient()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <SessionProvider>
          <App />
        </SessionProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
```

- [ ] **Step 2: Replace `src/App.tsx`**

```tsx
import { Routes, Route } from 'react-router-dom'
import { Protected } from './auth/Protected'
import { AppShell } from './components/AppShell'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Today from './pages/Today'
import Week from './pages/Week'
import Journal from './pages/Journal'
import Progress from './pages/Progress'
import Profile from './pages/Profile'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/onboarding"
        element={
          <Protected>
            <Onboarding />
          </Protected>
        }
      />
      <Route
        path="/*"
        element={
          <Protected>
            <AppShell>
              <Routes>
                <Route path="/" element={<Today />} />
                <Route path="/week" element={<Week />} />
                <Route path="/journal" element={<Journal />} />
                <Route path="/progress" element={<Progress />} />
                <Route path="/profile" element={<Profile />} />
              </Routes>
            </AppShell>
          </Protected>
        }
      />
    </Routes>
  )
}
```

- [ ] **Step 3: Typecheck + build**

Run: `npm run build`
Expected: TypeScript compiles, Vite build succeeds with no errors.

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS (the 5 gate tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire router, providers, and route guards"
```

---

## Task 14: Vercel config + /api health stub

**Files:**
- Create: `vercel.json`, `api/health.ts`

- [ ] **Step 1: Create `vercel.json` (SPA rewrite, leave /api alone)**

```json
{
  "rewrites": [
    { "source": "/((?!api/).*)", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 2: Create `api/health.ts` (proves serverless routing works on Vercel)**

```ts
export const config = { runtime: 'edge' }

export default function handler() {
  return new Response(JSON.stringify({ ok: true, phase: 0 }), {
    headers: { 'content-type': 'application/json' },
  })
}
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: vercel SPA config + /api/health stub"
```

---

## Task 15 (CHECKPOINT — interactive with Corey): Manual end-to-end verification

Use the browser preview tools to drive the running app; do not ask Corey to test manually.

- [ ] **Step 1: Start the dev server** via `preview_start` with a `.claude/launch.json` entry running `npm run dev` on port 5173. (Create `.claude/launch.json` if missing.)

- [ ] **Step 2: Verify the login gate** — navigating to `/` with no session redirects to `/login` (amber/navy design renders).

- [ ] **Step 3: Sign up** with Corey's real email + a password Corey types (Claude does not enter credentials). Confirm redirect to `/onboarding` (because `onboarding_complete` is false and the `handle_new_user` trigger created the profile row).

- [ ] **Step 4: Confirm the onboarding gate holds** — manually navigating to `/week` bounces back to `/onboarding`.

- [ ] **Step 5: Temporarily flip the gate to see the shell** — in Supabase Table Editor set the profile's `onboarding_complete = true`, reload; confirm `/`, `/week`, `/journal`, `/progress`, `/profile` all render inside the shell with working nav (bottom tabs on mobile viewport via `resize_window`, side nav on desktop). Then set it back to `false`.

- [ ] **Step 6: Screenshot** the login screen and the app shell as proof; share with Corey.

- [ ] **Step 7: Final commit** (any launch.json / small fixes)

```bash
git add -A
git commit -m "chore: phase 0 verification + launch config"
```

---

## Definition of Done (Phase 0)

- `npm run build` and `npm test` both pass.
- Supabase project exists with all 9 tables, RLS enabled on every table, drill library seeded (9 rows).
- Unauthenticated → `/login`; authed-without-onboarding → `/onboarding`; onboarded → app shell.
- The navy/charcoal + amber design system renders on the login page and app shell, responsive (bottom tabs mobile / side nav desktop).
- No secrets committed (`.env.local` gitignored; `GEMINI_API_KEY` only referenced, not present).
