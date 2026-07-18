import { describe, it, expect } from 'vitest'
import { summarizeWeek } from './progressStats'

describe('summarizeWeek', () => {
  it('computes adherence, avg RPE, adjustments, and by-type counts', () => {
    const s = summarizeWeek({
      plannedCount: 5,
      completions: [
        { actual_rpe: 7, actual_type: 'oncourt' },
        { actual_rpe: 6, actual_type: 'strength' },
        { actual_rpe: null, actual_type: 'oncourt' },
      ],
      decisions: [
        { date: '2026-07-13', decision: 'keep' },
        { date: '2026-07-14', decision: 'scale_down' },
        { date: '2026-07-15', decision: 'rest' },
      ],
    })
    expect(s.planned).toBe(5)
    expect(s.completed).toBe(3)
    expect(s.adherencePct).toBe(60)
    expect(s.avgActualRpe).toBe(6.5)
    expect(s.adjustments).toEqual([
      { date: '2026-07-14', decision: 'scale_down' },
      { date: '2026-07-15', decision: 'rest' },
    ])
    expect(s.byType).toEqual({ oncourt: 2, strength: 1 })
  })
  it('handles an empty week without dividing by zero', () => {
    const s = summarizeWeek({ plannedCount: 0, completions: [], decisions: [] })
    expect(s).toEqual({ planned: 0, completed: 0, adherencePct: 0, avgActualRpe: null, adjustments: [], byType: {} })
  })
})
