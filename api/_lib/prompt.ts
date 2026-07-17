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
