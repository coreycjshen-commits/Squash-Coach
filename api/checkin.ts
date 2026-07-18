import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clientFromRequest } from './_lib/supabaseServer'
import { callGroqJSON } from './_lib/groq'
import { buildCheckinMessages } from './_lib/prompt'
import { checkGuardrails } from '../src/lib/guardrails'
import { DecisionSchema, type Decision } from '../src/lib/decisionSchema'
import { currentPhase, type Macrocycle } from '../src/lib/macrocycle'
import { startOfWeekISO } from '../src/lib/week'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const supabase = clientFromRequest(req.headers.authorization)
  if (!supabase) return res.status(401).json({ error: 'Missing bearer token' })
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) return res.status(401).json({ error: 'Invalid session' })
  const userId = userData.user.id

  const date = typeof req.body?.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(req.body.date)
    ? req.body.date : new Date().toISOString().slice(0, 10)

  const { data: checkin } = await supabase
    .from('daily_checkins').select('*').eq('user_id', userId).eq('date', date).maybeSingle()
  if (!checkin) return res.status(400).json({ error: 'No check-in for today yet' })

  const { data: journalRow } = await supabase
    .from('journal_entries').select('body').eq('user_id', userId).eq('date', date)
    .order('created_at', { ascending: false }).limit(1).maybeSingle()
  const journal = journalRow?.body ?? ''

  const { data: session } = await supabase
    .from('sessions').select('type, focus, duration_min, target_rpe')
    .eq('user_id', userId).eq('day', date).order('order_index').limit(1).maybeSingle()

  const guard = checkGuardrails({
    journal, sleep_hours: checkin.sleep_hours, rhr_delta: checkin.rhr_delta, hrv_delta: checkin.hrv_delta,
  })

  let decision: Decision
  let source: 'guardrail' | 'llm' | 'fallback'
  let raw: string | null = null

  if (guard.forceRest) {
    decision = { decision: 'rest', rationale: `Recommending rest: ${guard.reasons.join('; ')}. Recover today — pushing through these signals risks injury or a deeper dip.`, adjusted_session: { type: 'rest', focus: 'Full recovery', duration_min: 0, target_rpe: 1, detail: { notes: 'Sleep, hydrate, light mobility only.' } } }
    source = 'guardrail'
  } else {
    const { data: macroRow } = await supabase
      .from('macrocycles').select('start_date, end_date, block_type, phases')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    const phase = macroRow ? currentPhase(macroRow as Macrocycle, startOfWeekISO(date)).name : 'General Prep'

    const { data: profile } = await supabase
      .from('profiles')
      .select('playstyle, us_squash_rating, level_descriptor, days_per_week, avg_session_min, has_partner_default, gym_access, goal_type, injuries, focus_areas, recent_context, season_status')
      .eq('id', userId).single()

    try {
      const messages = buildCheckinMessages({
        profile: { ...profile!, injuries: (profile!.injuries as string[]) ?? [], focus_areas: (profile!.focus_areas as string[]) ?? [] },
        phase,
        plannedSession: session ?? null,
        deltas: { hrv_delta: checkin.hrv_delta, rhr_delta: checkin.rhr_delta, sleep_delta: checkin.sleep_delta },
        sleep_hours: checkin.sleep_hours,
        yesterday_rpe: checkin.yesterday_rpe,
        partner_available: checkin.partner_available ?? true,
        court_available: checkin.court_available ?? true,
        minutes_available: checkin.minutes_available,
        journal,
      })
      const json = await callGroqJSON(messages)
      raw = JSON.stringify(json)
      decision = DecisionSchema.parse(json)
      source = 'llm'
    } catch (e) {
      raw = e instanceof Error ? e.message : String(e)
      decision = { decision: 'keep', rationale: 'Keeping today as planned (the coach model was unavailable to adjust).', adjusted_session: null }
      source = 'fallback'
    }
  }

  await supabase.from('daily_checkins').update({
    decision: decision.decision,
    decision_rationale: decision.rationale,
    adjusted_session: decision.adjusted_session ?? null,
    decision_source: source,
  }).eq('id', checkin.id)

  await supabase.from('llm_logs').insert({
    user_id: userId, call_type: 'daily',
    input_summary: { date, guardrail: guard.forceRest, reasons: guard.reasons },
    raw_response: raw, parsed: decision, status: source === 'llm' ? 'ok' : source === 'fallback' ? 'fallback' : 'ok',
  })

  return res.status(200).json({ ...decision, source })
}
