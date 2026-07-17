import type { VercelRequest, VercelResponse } from '@vercel/node'
import { clientFromRequest } from './_lib/supabaseServer'
import { callGroqText } from './_lib/groq'
import { buildCoachMessages } from './_lib/prompt'
import { currentPhase, type Macrocycle } from '../src/lib/macrocycle'
import { startOfWeekISO } from '../src/lib/week'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const supabase = clientFromRequest(req.headers.authorization)
  if (!supabase) return res.status(401).json({ error: 'Missing bearer token' })
  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) return res.status(401).json({ error: 'Invalid session' })
  const userId = userData.user.id

  const message = typeof req.body?.message === 'string' ? req.body.message.trim() : ''
  if (!message) return res.status(400).json({ error: 'Empty message' })

  const { data: profile } = await supabase
    .from('profiles')
    .select('playstyle, us_squash_rating, level_descriptor, days_per_week, avg_session_min, has_partner_default, gym_access, goal_type, injuries, focus_areas, recent_context, season_status')
    .eq('id', userId).single()
  if (!profile) return res.status(400).json({ error: 'Complete onboarding first' })

  const { data: macroRow } = await supabase
    .from('macrocycles').select('start_date, end_date, block_type, phases')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  const weekStart = startOfWeekISO(new Date().toISOString().slice(0, 10))
  const phase = macroRow ? currentPhase(macroRow as Macrocycle, weekStart).name : 'General Prep'

  const { data: plan } = await supabase
    .from('weekly_plans').select('id, rationale').eq('user_id', userId).eq('week_start', weekStart).maybeSingle()
  let weekSummary = 'no plan generated for this week yet'
  if (plan) {
    const { data: sessions } = await supabase
      .from('sessions').select('type, focus, target_rpe').eq('weekly_plan_id', plan.id).order('order_index')
    weekSummary = (sessions ?? []).map((s) => `${s.type} (${s.focus}, RPE ${s.target_rpe})`).join('; ') || 'plan has no sessions'
  }

  const { data: historyRows } = await supabase
    .from('coach_messages').select('role, content')
    .eq('user_id', userId).order('created_at', { ascending: false }).limit(12)
  const history = (historyRows ?? []).reverse().map((m) => ({
    role: (m.role === 'coach' ? 'assistant' : 'user') as 'user' | 'assistant',
    content: m.content,
  }))

  let reply: string
  try {
    reply = await callGroqText(
      buildCoachMessages({
        profile: { ...profile, injuries: (profile.injuries as string[]) ?? [], focus_areas: (profile.focus_areas as string[]) ?? [] },
        phase, weekSummary, history, userMessage: message,
      }),
    )
  } catch (e) {
    return res.status(502).json({ error: e instanceof Error ? e.message : 'Coach unavailable' })
  }

  await supabase.from('coach_messages').insert([
    { user_id: userId, role: 'user', content: message },
    { user_id: userId, role: 'coach', content: reply },
  ])

  return res.status(200).json({ reply })
}
