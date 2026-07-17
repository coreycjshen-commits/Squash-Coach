import { describe, it, expect } from 'vitest'
import { weeksBetween, addWeeks, todayISO } from './dates'

describe('weeksBetween', () => {
  it('counts whole weeks, rounding up a partial week', () => {
    expect(weeksBetween('2026-01-01', '2026-01-01')).toBe(0)
    expect(weeksBetween('2026-01-01', '2026-01-08')).toBe(1)
    expect(weeksBetween('2026-01-01', '2026-01-10')).toBe(2)
    expect(weeksBetween('2026-01-01', '2026-03-26')).toBe(12)
  })
  it('returns 0 when end is before start', () => {
    expect(weeksBetween('2026-02-01', '2026-01-01')).toBe(0)
  })
})

describe('addWeeks', () => {
  it('adds N weeks and returns an ISO date string', () => {
    expect(addWeeks('2026-01-01', 2)).toBe('2026-01-15')
  })
})

describe('todayISO', () => {
  it('returns a YYYY-MM-DD string', () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
