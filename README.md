# Squash Coach

A personal, adaptive squash training app that behaves like a coach: it builds a periodized
training block, generates a specific weekly plan, talks with you, and adapts each day's session
to how you're actually recovering.

## Stack
- **Frontend:** React + Vite + TypeScript, React Router, TanStack Query, Tailwind (navy/amber design system)
- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **AI (server-side only):** Groq (OpenAI-compatible API) for weekly plan generation, coach chat, and daily check-in interpretation
- **Deploy:** Vercel (SPA + `/api/*` serverless functions)

## Features
- Multi-step onboarding → deterministic periodized macrocycle (General Prep → Specific Prep → Pre-Comp/Power → Competition)
- Weekly plan generation with trainer-level session detail (named drills, sets × time, intervals, loads)
- A coach chat that remembers the conversation and plans around your focus/context
- Daily check-in (wearables + journal) → rolling baseline + acute:chronic load
- Adaptive daily decision (keep / scale / change / rest) — **hard-coded safety guardrails run before the LLM**
- Deterministic solo/ghosting substitution when you have no partner
- Today ↔ Week live-status sync; off-plan session logging

## Local development
```bash
npm install
cp .env.local.example .env.local   # fill in Supabase URL + anon key; GROQ key for AI features
npm run dev                        # Vite dev server also serves /api/* handlers (no Vercel CLI needed)
npm test                           # unit tests (baseline/ACWR, guardrails, schemas, macrocycle, solo)
```

## Database
Apply the migrations in `supabase/migrations/` (in order) to a Supabase project, then run
`supabase/seed.sql` to seed the solo-drill library.

## Environment variables
| Var | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | client + server | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client + server | Supabase anon key (public, RLS-protected) |
| `GROQ_API_KEY` | **server only** | Groq API key (never exposed to the client) |
| `GROQ_MODEL` | server | Groq model id (default `llama-3.3-70b-versatile`) |

Server-side LLM calls run only in `/api/*` functions, so the Groq key never reaches the browser.
