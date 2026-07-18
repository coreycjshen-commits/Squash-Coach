import { describe, it, expect } from 'vitest'
import { computeBaseline, computeDeltas, computeACWR } from './baseline'

describe('computeBaseline', () => {
  it('averages non-null values to 1dp', () => {
    const b = computeBaseline([
      { hrv: 60, resting_hr: 50, sleep_hours: 8 },
      { hrv: 70, resting_hr: 52, sleep_hours: 7 },
    ])
    expect(b).toEqual({ hrv: 65, resting_hr: 51, sleep_hours: 7.5 })
  })
  it('ignores nulls; returns null for an all-null metric', () => {
    const b = computeBaseline([{ hrv: null, resting_hr: 50, sleep_hours: null }])
    expect(b).toEqual({ hrv: null, resting_hr: 50, sleep_hours: null })
  })
  it('returns all-null for empty history', () => {
    expect(computeBaseline([])).toEqual({ hrv: null, resting_hr: null, sleep_hours: null })
  })
})

describe('computeDeltas', () => {
  it('subtracts baseline from today (today - baseline)', () => {
    const d = computeDeltas(
      { hrv: 55, resting_hr: 54, sleep_hours: 6 },
      { hrv: 65, resting_hr: 51, sleep_hours: 7.5 },
    )
    expect(d).toEqual({ hrv_delta: -10, rhr_delta: 3, sleep_delta: -1.5 })
  })
  it('null when either side missing', () => {
    const d = computeDeltas({ hrv: null, resting_hr: 54, sleep_hours: 6 }, { hrv: 65, resting_hr: null, sleep_hours: 7.5 })
    expect(d).toEqual({ hrv_delta: null, rhr_delta: null, sleep_delta: -1.5 })
  })
})

describe('computeACWR', () => {
  it('null when there is no chronic load', () => {
    expect(computeACWR([], '2026-07-17')).toBeNull()
  })
  it('acute (7d total) over chronic weekly avg (28d/4)', () => {
    const loads = Array.from({ length: 28 }, (_, i) => ({
      date: new Date(Date.parse('2026-07-17') - i * 86_400_000).toISOString().slice(0, 10),
      load: 100,
    }))
    expect(computeACWR(loads, '2026-07-17')).toBe(1)
  })
  it('flags a spike (acute >> chronic) as >1', () => {
    const loads = [
      ...Array.from({ length: 7 }, (_, i) => ({ date: new Date(Date.parse('2026-07-17') - i * 86_400_000).toISOString().slice(0, 10), load: 300 })),
      ...Array.from({ length: 21 }, (_, i) => ({ date: new Date(Date.parse('2026-07-17') - (i + 7) * 86_400_000).toISOString().slice(0, 10), load: 50 })),
    ]
    const acwr = computeACWR(loads, '2026-07-17')!
    expect(acwr).toBeGreaterThan(1.5)
  })
})
