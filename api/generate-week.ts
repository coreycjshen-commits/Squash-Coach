import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clientFromRequest } from './_lib/supabaseServer'
import { callGroqJSON } from './_lib/groq'
import { buildWeeklyMessages } from './_lib/prompt'
import { WeeklyPlanSchema, type WeeklyPlan } from '../src/lib/planSchema'
import { buildTemplateWeek } from '../src/lib/template'
import { currentPhase, type Macrocycle } from '../src/lib/macrocycle'
import { startOfWeekISO } from '../src/lib/week'
import { addWeeks } from '../src/lib/dates'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const supabase = clientFromRequest(req.headers.authorization)
  if (!supabase) return res.status(401).json({ error: 'Missing bearer token' })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) return res.status(401).json({ error: 'Invalid session' })
  const userId = userData.user.id

  const { data: profile } = await supabase
    .from('profiles')
    .select('playstyle, us_squash_rating, level_descriptor, days_per_week, avg_session_min, has_partner_default, gym_access, goal_type, injuries')
    .eq('id', userId)
    .single()
  if (!profile) return res.status(400).json({ error: 'Complete onboarding first' })

  const { data: macroRow } = await supabase
    .from('macrocycles')
    .select('start_date, end_date, block_type, phases')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const weekStart = startOfWeekISO(new Date().toISOString().slice(0, 10))
  const phase = macroRow ? currentPhase(macroRow as Macrocycle, weekStart).name : 'General Prep'

  const lastWeekStart = addWeeks(weekStart, -1)
  let lastWeek = { planned: 0, completed: 0, rpeTrend: 'n/a', journalThemes: 'n/a' }
  try {
    const { data: prevPlan } = await supabase
      .from('weekly_plans').select('id').eq('user_id', userId).eq('week_start', lastWeekStart).maybeSingle()
    if (prevPlan) {
      const { count: planned } = await supabase
        .from('sessions').select('id', { count: 'exact', head: true }).eq('weekly_plan_id', prevPlan.id)
      const { data: done } = await supabase
        .from('completed_sessions').select('actual_rpe').eq('user_id', userId).gte('date', lastWeekStart).lt('date', weekStart)
      const rpes = (done ?? []).map((d) => d.actual_rpe).filter((n): n is number => n != null)
      lastWeek = {
        planned: planned ?? 0,
        completed: done?.length ?? 0,
        rpeTrend: rpes.length ? `avg ${(rpes.reduce((a, b) => a + b, 0) / rpes.length).toFixed(1)}` : 'n/a',
        journalThemes: 'n/a',
      }
    }
  } catch {
    // non-fatal
  }

  let plan: WeeklyPlan
  let source: 'llm' | 'fallback' = 'llm'
  let raw: string | null = null
  try {
    const messages = buildWeeklyMessages({
      profile: { ...profile, injuries: (profile.injuries as string[]) ?? [] },
      phase, weekStart, lastWeek,
    })
    const json = await callGroqJSON(messages)
    raw = JSON.stringify(json)
    plan = WeeklyPlanSchema.parse(json)
  } catch (e) {
    source = 'fallback'
    raw = e instanceof Error ? e.message : String(e)
    plan = buildTemplateWeek(phase, profile.days_per_week ?? 3, profile.avg_session_min ?? 60)
  }

  await supabase.from('weekly_plans').delete().eq('user_id', userId).eq('week_start', weekStart)
  const { data: planRow, error: planErr } = await supabase
    .from('weekly_plans')
    .insert({
      user_id: userId,
      macrocycle_id: null,
      week_start: weekStart,
      phase,
      rationale: plan.rationale,
      status: 'active',
      generated_by: source,
    })
    .select('id')
    .single()
  if (planErr || !planRow) return res.status(500).json({ error: 'Failed to save plan' })

  const rows = plan.sessions.map((s, i) => ({
    user_id: userId,
    weekly_plan_id: planRow.id,
    day: new Date(Date.parse(weekStart) + s.day_index * 86_400_000).toISOString().slice(0, 10),
    type: s.type,
    focus: s.focus,
    duration_min: s.duration_min,
    target_rpe: s.target_rpe,
    detail: s.detail,
    order_index: i,
  }))
  const { error: sessErr } = await supabase.from('sessions').insert(rows)
  if (sessErr) return res.status(500).json({ error: 'Failed to save sessions' })

  await supabase.from('llm_logs').insert({
    user_id: userId,
    call_type: 'weekly',
    input_summary: { phase, weekStart, days: profile.days_per_week },
    raw_response: raw,
    parsed: plan,
    status: source === 'llm' ? 'ok' : 'fallback',
  })

  return res.status(200).json({ ok: true, source, plan_id: planRow.id, phase, week_start: weekStart })
}
