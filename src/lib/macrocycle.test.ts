import { describe, it, expect } from 'vitest'
import { buildMacrocycle, currentPhase, type Macrocycle } from './macrocycle'

describe('buildMacrocycle', () => {
  it('rolling 10-week block when no goal date', () => {
    const m = buildMacrocycle('2026-01-01', null)
    expect(m.block_type).toBe('rolling')
    expect(m.start_date).toBe('2026-01-01')
    expect(m.end_date).toBe('2026-03-12')
    expect(m.phases).toEqual([
      { name: 'General Prep', start_week: 1, end_week: 4 },
      { name: 'Specific Prep', start_week: 5, end_week: 8 },
      { name: 'Pre-Competitive / Power', start_week: 9, end_week: 10 },
    ])
  })

  it('fixed-goal 12-week block splits 4 phases summing to total', () => {
    const m = buildMacrocycle('2026-01-01', '2026-03-26')
    expect(m.block_type).toBe('fixed_goal')
    expect(m.end_date).toBe('2026-03-26')
    const total = m.phases.reduce((n, p) => n + (p.end_week - p.start_week + 1), 0)
    expect(total).toBe(12)
    expect(m.phases.map((p) => p.name)).toEqual([
      'General Prep',
      'Specific Prep',
      'Pre-Competitive / Power',
      'Competition / Maintenance',
    ])
    expect(m.phases.map((p) => p.end_week - p.start_week + 1)).toEqual([4, 4, 2, 2])
    expect(m.phases[0].start_week).toBe(1)
    expect(m.phases[3].end_week).toBe(12)
  })

  it('every phase gets at least 1 week in a short 4-week fixed goal', () => {
    const m = buildMacrocycle('2026-01-01', '2026-01-29')
    expect(m.phases.map((p) => p.end_week - p.start_week + 1)).toEqual([1, 1, 1, 1])
  })

  it('sub-4-week goal collapses to a single peak phase', () => {
    const m = buildMacrocycle('2026-01-01', '2026-01-15')
    expect(m.block_type).toBe('fixed_goal')
    expect(m.phases).toEqual([
      { name: 'Competition / Maintenance', start_week: 1, end_week: 2 },
    ])
  })
})

describe('currentPhase', () => {
  const m: Macrocycle = buildMacrocycle('2026-01-01', '2026-03-26')
  it('returns General Prep in week 1', () => {
    expect(currentPhase(m, '2026-01-01').name).toBe('General Prep')
  })
  it('returns Specific Prep in week 5', () => {
    expect(currentPhase(m, '2026-01-29').name).toBe('Specific Prep')
  })
  it('clamps past the end to the final phase', () => {
    expect(currentPhase(m, '2026-05-01').name).toBe('Competition / Maintenance')
  })
  it('clamps before the start to the first phase', () => {
    expect(currentPhase(m, '2025-12-01').name).toBe('General Prep')
  })
})
