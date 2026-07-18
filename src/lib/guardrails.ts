export interface GuardrailInput {
  journal: string
  sleep_hours: number | null
  rhr_delta: number | null
  hrv_delta: number | null
}
export interface GuardrailResult {
  forceRest: boolean
  reasons: string[]
}

const SLEEP_FLOOR_H = 4
const RHR_SPIKE_BPM = 10
const HRV_DROP_MS = -15

const PAIN = /\b(pain|sharp|tweak(ed)?|strain(ed)?|pulled|injur(y|ed|ies)|sprain(ed)?|swollen|hurts?)\b/i
const NEGATED_PAIN = /\b(no|without|zero)\s+pain\b|pain[-\s]?free|painless|no\s+injur/i

export function checkGuardrails(i: GuardrailInput): GuardrailResult {
  const reasons: string[] = []
  if (PAIN.test(i.journal) && !NEGATED_PAIN.test(i.journal)) reasons.push('journal mentions pain/injury')
  if (i.sleep_hours != null && i.sleep_hours < SLEEP_FLOOR_H) reasons.push(`severe sleep loss (${i.sleep_hours}h)`)
  if (i.rhr_delta != null && i.rhr_delta >= RHR_SPIKE_BPM) reasons.push(`resting HR ${i.rhr_delta} bpm above baseline`)
  if (i.hrv_delta != null && i.hrv_delta <= HRV_DROP_MS) reasons.push(`HRV ${i.hrv_delta} ms below baseline`)
  return { forceRest: reasons.length > 0, reasons }
}
