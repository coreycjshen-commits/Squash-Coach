import type { WeeklyPlan, PlanSession } from './planSchema'
import { SESSION_TYPES } from './planSchema'

type TrainingType = Exclude<(typeof SESSION_TYPES)[number], 'rest'>

interface Slot {
  type: TrainingType
  focus: string
  rpe: number
  detail: Record<string, unknown>
}

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

export function buildTemplateWeek(phase: string, days: number, avgSessionMin: number): WeeklyPlan {
  const slots = PHASE_SLOTS[phase] ?? PHASE_SLOTS[FALLBACK_PHASE]
  const n = Math.max(1, Math.min(7, Math.floor(days) || 1))
  const dur = Math.max(20, Math.min(180, Math.floor(avgSessionMin) || 60))

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

function spreadDays(n: number): number[] {
  if (n >= 7) return [0, 1, 2, 3, 4, 5, 6]
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(Math.round((i * 6) / Math.max(1, n - 1 || 1)))
  const seen = new Set<number>()
  return out.map((d) => {
    let v = d
    while (seen.has(v)) v = (v + 1) % 7
    seen.add(v)
    return v
  })
}
