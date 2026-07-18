import { describe, it, expect } from 'vitest'
import { inferFocus, pickSoloDrill, type SoloDrill } from './solo'

const drills: SoloDrill[] = [
  { id: 'm1', focus: 'movement', name: '6-Corner Star Ghosting', structure: {}, target_intensity: 8, duration_min: 30, equivalent_for: 'oncourt' },
  { id: 't1', focus: 'touch', name: 'Solo Rail Hitting', structure: {}, target_intensity: 5, duration_min: 30, equivalent_for: 'oncourt' },
  { id: 'f1', focus: 'fitness', name: 'Court Sprint Intervals', structure: {}, target_intensity: 9, duration_min: 25, equivalent_for: 'cardio' },
  { id: 'x1', focus: 'mixed', name: 'Ghost + Hit Pyramid', structure: {}, target_intensity: 7, duration_min: 35, equivalent_for: 'oncourt' },
]

describe('inferFocus', () => {
  it('maps touch-y language to touch', () => {
    expect(inferFocus({ type: 'oncourt', focus: 'Backhand length & drop accuracy', target_rpe: 6, duration_min: 60 })).toBe('touch')
  })
  it('maps movement/ghosting language to movement', () => {
    expect(inferFocus({ type: 'oncourt', focus: 'Ghosting and front-court movement', target_rpe: 7, duration_min: 45 })).toBe('movement')
  })
  it('defaults to mixed when nothing matches', () => {
    expect(inferFocus({ type: 'oncourt', focus: 'General session', target_rpe: 6, duration_min: 60 })).toBe('mixed')
  })
})

describe('pickSoloDrill', () => {
  it('prefers a drill matching the inferred focus, nearest intensity', () => {
    const d = pickSoloDrill({ type: 'oncourt', focus: 'straight-drive length and touch', target_rpe: 5, duration_min: 45 }, drills)
    expect(d?.id).toBe('t1')
  })
  it('picks an oncourt-equivalent movement drill for a ghosting session', () => {
    const d = pickSoloDrill({ type: 'oncourt', focus: 'ghosting movement', target_rpe: 8, duration_min: 40 }, drills)
    expect(d?.id).toBe('m1')
  })
  it('returns null when no drills available', () => {
    expect(pickSoloDrill({ type: 'oncourt', focus: 'x', target_rpe: 6, duration_min: 60 }, [])).toBeNull()
  })
})
