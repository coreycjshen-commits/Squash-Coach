import { supabase } from './supabase'
import { todayISO } from './dates'
import {
  computeBaseline, computeDeltas, computeACWR, type LoadEntry,
} from './baseline'
import type { SoloDrill } from './solo'

export interface CheckinRow {
  id: string
  date: string
  resting_hr: number | null
  hrv: number | null
  sleep_hours: number | null
  sleep_quality: number | null
  yesterday_rpe: number | null
  partner_available: boolean | null
  court_available: boolean | null
  minutes_available: number | null
  hrv_delta: number | null
  rhr_delta: number | null
  sleep_delta: number | null
  acwr: number | null
  decision: string | null
  decision_rationale: string | null
  adjusted_session: Record<string, unknown> | null
  decision_source: string | null
}

export interface TodaySessionRow {
  id: string
  type: 'oncourt' | 'strength' | 'cardio' | 'rest'
  focus: string | null
  duration_min: number | null
  target_rpe: number | null
  detail: Record<string, unknown>
}

export interface CompletionRow {
  id: string
  actual_type: string | null
  actual_duration: number | null
  actual_rpe: number | null
  notes: string | null
}

export interface TodayContext {
  date: string
  checkin: CheckinRow | null
  session: TodaySessionRow | null
  drills: SoloDrill[]
  completion: CompletionRow | null
}

export interface CheckinInput {
  resting_hr: number | null
  hrv: number | null
  sleep_hours: number | null
  sleep_quality: number | null
  yesterday_rpe: number | null
  partner_available: boolean
  court_available: boolean
  minutes_available: number | null
  journal: string
}

export async function loadTodayContext(userId: string): Promise<TodayContext> {
  const date = todayISO()

  const { data: checkin } = await supabase
    .from('daily_checkins').select('*').eq('user_id', userId).eq('date', date).maybeSingle()

  const { data: session } = await supabase
    .from('sessions').select('id, type, focus, duration_min, target_rpe, detail')
    .eq('user_id', userId).eq('day', date).order('order_index').limit(1).maybeSingle()

  const { data: drills } = await supabase
    .from('solo_drill_library').select('id, focus, name, structure, target_intensity, duration_min, equivalent_for')

  const { data: completion } = await supabase
    .from('completed_sessions').select('id, actual_type, actual_duration, actual_rpe, notes')
    .eq('user_id', userId).eq('date', date).maybeSingle()

  return {
    date,
    checkin: (checkin as CheckinRow) ?? null,
    session: (session as TodaySessionRow) ?? null,
    drills: (drills as SoloDrill[]) ?? [],
    completion: (completion as CompletionRow) ?? null,
  }
}

export async function saveCheckin(userId: string, input: CheckinInput): Promise<void> {
  const date = todayISO()

  const { data: recentCheckins } = await supabase
    .from('daily_checkins').select('hrv, resting_hr, sleep_hours, date')
    .eq('user_id', userId).lt('date', date).order('date', { ascending: false }).limit(7)
  const baseline = computeBaseline((recentCheckins ?? []).map((r) => ({ hrv: r.hrv, resting_hr: r.resting_hr, sleep_hours: r.sleep_hours })))
  const deltas = computeDeltas({ hrv: input.hrv, resting_hr: input.resting_hr, sleep_hours: input.sleep_hours }, baseline)

  const from = new Date(Date.parse(date) - 28 * 86_400_000).toISOString().slice(0, 10)
  const { data: completed } = await supabase
    .from('completed_sessions').select('date, actual_duration, actual_rpe')
    .eq('user_id', userId).gte('date', from)
  const loads: LoadEntry[] = (completed ?? [])
    .filter((c) => c.actual_duration != null && c.actual_rpe != null)
    .map((c) => ({ date: c.date, load: (c.actual_duration as number) * (c.actual_rpe as number) }))
  const acwr = computeACWR(loads, date)

  const { data: saved, error } = await supabase
    .from('daily_checkins')
    .upsert({
      user_id: userId,
      date,
      resting_hr: input.resting_hr,
      hrv: input.hrv,
      sleep_hours: input.sleep_hours,
      sleep_quality: input.sleep_quality,
      yesterday_rpe: input.yesterday_rpe,
      partner_available: input.partner_available,
      court_available: input.court_available,
      minutes_available: input.minutes_available,
      hrv_delta: deltas.hrv_delta,
      rhr_delta: deltas.rhr_delta,
      sleep_delta: deltas.sleep_delta,
      acwr,
    }, { onConflict: 'user_id,date' })
    .select('id')
    .single()
  if (error) throw error

  if (input.journal.trim()) {
    await supabase.from('journal_entries').insert({
      user_id: userId, date, checkin_id: saved.id, body: input.journal.trim(),
    })
  }
}

export async function requestDecision(): Promise<{ ok: boolean; error?: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { ok: false, error: 'Not signed in' }
  const res = await fetch('/api/checkin', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ date: todayISO() }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: body.error ?? `Server error ${res.status}` }
  return { ok: true }
}

export async function completeSession(
  userId: string,
  input: { session_id: string | null; actual_type: string; actual_duration: number | null; actual_rpe: number | null; adjustment: string | null; notes: string },
): Promise<void> {
  const date = todayISO()
  await supabase.from('completed_sessions').delete().eq('user_id', userId).eq('date', date)
  const { error } = await supabase.from('completed_sessions').insert({
    user_id: userId, session_id: input.session_id, date,
    actual_type: input.actual_type, actual_duration: input.actual_duration, actual_rpe: input.actual_rpe,
    adjustment: input.adjustment, notes: input.notes.trim() || null,
  })
  if (error) throw error
}
