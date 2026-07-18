import { describe, it, expect } from 'vitest'
import { checkGuardrails } from './guardrails'

describe('checkGuardrails', () => {
  it('forces rest when the journal mentions pain/injury', () => {
    const r = checkGuardrails({ journal: 'sharp pain in my right knee today', sleep_hours: 8, rhr_delta: 0, hrv_delta: 0 })
    expect(r.forceRest).toBe(true)
    expect(r.reasons.join(' ')).toMatch(/pain|injur/i)
  })
  it('does NOT trigger on negated pain ("no pain")', () => {
    expect(checkGuardrails({ journal: 'legs sore but no pain, feeling good', sleep_hours: 8, rhr_delta: 0, hrv_delta: 0 }).forceRest).toBe(false)
  })
  it('forces rest on severe sleep loss (<4h)', () => {
    expect(checkGuardrails({ journal: 'ok', sleep_hours: 3.5, rhr_delta: 0, hrv_delta: 0 }).forceRest).toBe(true)
  })
  it('forces rest when resting HR is far above baseline (+10)', () => {
    expect(checkGuardrails({ journal: 'ok', sleep_hours: 7, rhr_delta: 12, hrv_delta: 0 }).forceRest).toBe(true)
  })
  it('forces rest when HRV is far below baseline (-15)', () => {
    expect(checkGuardrails({ journal: 'ok', sleep_hours: 7, rhr_delta: 0, hrv_delta: -20 }).forceRest).toBe(true)
  })
  it('passes a normal check-in through', () => {
    const r = checkGuardrails({ journal: 'felt good, bit tired', sleep_hours: 7, rhr_delta: 2, hrv_delta: -3 })
    expect(r.forceRest).toBe(false)
    expect(r.reasons).toEqual([])
  })
  it('tolerates null wearables (only journal applies)', () => {
    expect(checkGuardrails({ journal: 'all good', sleep_hours: null, rhr_delta: null, hrv_delta: null }).forceRest).toBe(false)
  })
})
