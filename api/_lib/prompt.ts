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
    focus_areas: string[]
    recent_context: string | null
    season_status: string | null
  }
  phase: string
  weekStart: string
  lastWeek: {
    planned: number
    completed: number
    rpeTrend: string
    journalThemes: string
  }
  coachNotes: string
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

On-court squash should appear on MOST training days — even lighter days keep court touch
(technical work, ghosting, or solo feeds). Reserve fully non-court days for dedicated conditioning,
mobility, or recovery, and true rest only when warranted. Wrap strength & conditioning AROUND
near-daily court work rather than replacing it. Honor the athlete's stated focus areas, season, and
recent context (e.g. ease back in after a break; protect freshness in-season; build base off-season).

Return STRICT JSON ONLY matching this shape:
{"rationale": string, "sessions": [{"day_index": 0-6 (0=Mon), "type": "oncourt"|"strength"|"cardio"|"rest",
"focus": string, "duration_min": int, "target_rpe": int 1-10, "detail": object}]}

Write "detail" like a REAL coach handing an athlete their session plan for the day — precise enough
to execute without asking a single question. BANNED: vague phrases like "technique drills",
"conditioning", "cardio", "ghosting patterns", "footwork drills", "core work". Every line must name
the exact drill/exercise, the pattern or movement, sets × (reps or time), work:rest, and a measurable
target or coaching cue. The numbers in "detail" must add up roughly to the session's duration_min.

Requirements by type:
- oncourt: name each drill AS A REAL SQUASH DRILL with the shot pattern (who plays what, where) and a
  target. Examples of the required specificity:
  "Straight-drive length: feed to back corner, hit 8 consecutive drives landing behind the service box, both walls — 4 sets × 3 min/side, 60s rest",
  "2-corner boast-drive: partner boasts, you run and hit straight drive then back to T — 5 × 90s, 60s rest",
  "6-point ghosting (2 front, 2 mid, 2 back): explode to each corner and shadow the shot — 6 × 40s work / 50s rest",
  "Drop-drive condition game to back-2/front-2: first to 11, must win by 2 — 3 games".
  Always include "warm_up" (specific: e.g. "5 min court movement + 20 boast-drive-drive feeds each side").
- cardio: name the modality AND the full interval structure with work, rest, sets, and a target.
  e.g. "10 × 15s max court sprints (baseline↔front wall), 45s walk, ×2 sets, 3 min between sets @ RPE 9".
  Steady-state must give duration + zone, e.g. "35 min run @ RPE 5 / zone 2, HR ~140-150".
- strength: each lift with sets × reps AND load guidance (%1RM or RPE) and tempo/rest where it matters.
  e.g. "Back squat 4 × 5 @ RPE 8 (~80%), 2-3 min rest", "Nordic curl 3 × 6 slow eccentric", "Pallof press 3 × 10/side".

Prefer these JSON keys: "warm_up", "drills"/"lifts"/"intervals" (arrays of specific strings),
"cool_down", "coaching_cue" (one key thing to focus on). Bake the athlete's focus areas into the
actual drills chosen (e.g. if focus is "backhand length", the on-court drills must target backhand length).

Two examples of the REQUIRED level of detail:
{"day_index":0,"type":"oncourt","focus":"Backhand length & deep control","duration_min":75,"target_rpe":7,
"detail":{"warm_up":"5 min movement + 3 min knock-up, 20 backhand boast-drive-drive feeds","drills":["Backhand straight-drive length: 8 drives landing behind service box — 5 sets × 3 min, 45s rest","Backhand boast + straight drive: partner boasts crosscourt, you drive straight — 4 × 90s each side","Length game backhand-side only: rally cross/straight, point ends if ball lands short of service line — 3 games to 11"],"cool_down":"8 min mobility (hips, T-spine, forearms)","coaching_cue":"Contact out in front, aim a racket-width off the side wall"}}
{"day_index":3,"type":"cardio","focus":"Repeated-sprint capacity","duration_min":35,"target_rpe":9,
"detail":{"warm_up":"10 min easy jog + leg swings","intervals":"10 × 15s max court sprints (baseline↔front wall), 45s walk recovery, 4 min rest, repeat ×2 sets","cool_down":"5 min walk + calf/quad stretch"}}

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
- Focus areas: ${p.focus_areas.length ? p.focus_areas.join('; ') : 'none specified'}
- Season: ${p.season_status ?? 'general'}
- Recent training & context: ${p.recent_context ?? 'n/a'}

CONTEXT
- Current macrocycle phase: ${input.phase}
- Week starting: ${input.weekStart}
- Last week: ${input.lastWeek.completed}/${input.lastWeek.planned} sessions completed; RPE trend: ${input.lastWeek.rpeTrend}; journal themes: ${input.lastWeek.journalThemes}
- Recent coach conversation (for continuity): ${input.coachNotes || 'none yet'}

Generate this week's plan now as JSON.`
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: user },
  ]
}

export interface CoachChatInput {
  profile: WeeklyPromptInput['profile']
  phase: string
  weekSummary: string
  history: { role: 'user' | 'assistant'; content: string }[]
  userMessage: string
}

const COACH_SYSTEM = `You are the athlete's personal squash coach — knowledgeable, direct, and encouraging.
You understand squash periodization (General Prep, Specific Prep, Pre-Competitive/Power, Competition/Maintenance),
the three training types (on-court, strength, cardio/intervals), RPE-based intensity, and solo/ghosting work.
Coach conversationally: answer questions, discuss what to focus on next, and PUSH BACK with reasoning when the
athlete suggests something unwise (e.g. ramping too fast after a break, or skipping recovery when fatigued).
Favor on-court squash on most days. Keep replies concise (2-5 sentences) unless asked for detail.
If the athlete wants their week changed, explain what you'd change and tell them to hit "Update my week"
(a button in the app regenerates the plan using this conversation). Do not output JSON — just talk.`

export function buildCoachMessages(input: CoachChatInput): ChatMessage[] {
  const p = input.profile
  const context = `ATHLETE CONTEXT
- Playstyle: ${p.playstyle ?? 'unspecified'}; Level: ${p.us_squash_rating != null ? `US Squash ${p.us_squash_rating}` : p.level_descriptor ?? 'unspecified'}
- Availability: ${p.days_per_week ?? 3} days/week, ~${p.avg_session_min ?? 60} min; gym: ${p.gym_access}; partner usually: ${p.has_partner_default ? 'yes' : 'no'}
- Goal: ${p.goal_type ?? 'general'}; Season: ${p.season_status ?? 'general'}
- Focus areas: ${p.focus_areas.length ? p.focus_areas.join('; ') : 'none specified'}
- Injuries: ${p.injuries.length ? p.injuries.join('; ') : 'none'}
- Recent context: ${p.recent_context ?? 'n/a'}
- Current phase: ${input.phase}. This week: ${input.weekSummary}`
  return [
    { role: 'system', content: `${COACH_SYSTEM}\n\n${context}` },
    ...input.history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: input.userMessage },
  ]
}

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
