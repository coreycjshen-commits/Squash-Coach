import { describe, it, expect } from 'vitest'
import { startOfWeekISO } from './week'

describe('startOfWeekISO', () => {
  it('returns the Monday of the week for a mid-week date', () => {
    expect(startOfWeekISO('2026-07-15')).toBe('2026-07-13')
  })
  it('returns the same date when it is already Monday', () => {
    expect(startOfWeekISO('2026-07-13')).toBe('2026-07-13')
  })
  it('treats Sunday as the end of the week (previous Monday)', () => {
    expect(startOfWeekISO('2026-07-19')).toBe('2026-07-13')
  })
})
