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
