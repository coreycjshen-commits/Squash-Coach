import { describe, it, expect } from 'vitest'
import { DecisionSchema } from './decisionSchema'

const base = { decision: 'keep', rationale: 'Recovery is solid; run it as planned.' }

describe('DecisionSchema', () => {
  it('accepts a keep decision with no adjusted session', () => {
    expect(DecisionSchema.safeParse(base).success).toBe(true)
  })
  it('accepts a change with an adjusted session', () => {
    const r = DecisionSchema.safeParse({
      decision: 'change_modality', rationale: 'Sore legs — swap the lift for mobility + touch.',
      adjusted_session: { type: 'oncourt', focus: 'Light touch & feel', duration_min: 40, target_rpe: 4, detail: { drills: ['soft drops 3 × 5 min'] } },
    })
    expect(r.success).toBe(true)
  })
  it('rejects an unknown decision', () => {
    expect(DecisionSchema.safeParse({ ...base, decision: 'yolo' }).success).toBe(false)
  })
  it('rejects an empty rationale', () => {
    expect(DecisionSchema.safeParse({ decision: 'rest', rationale: '' }).success).toBe(false)
  })
  it('rejects an adjusted session with a bad RPE', () => {
    expect(DecisionSchema.safeParse({ ...base, decision: 'scale_down', adjusted_session: { type: 'oncourt', focus: 'x', duration_min: 40, target_rpe: 99, detail: {} } }).success).toBe(false)
  })
})
