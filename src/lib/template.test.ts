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
