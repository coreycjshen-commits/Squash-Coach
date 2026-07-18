import { supabase } from './supabase'

export interface DayStatus {
  decision: string | null
  completed: boolean
  actual_rpe: number | null
  actual_type: string | null
}

export async function loadWeekStatus(userId: string, weekStart: string): Promise<Record<string, DayStatus>> {
  const end = new Date(Date.parse(weekStart) + 7 * 86_400_000).toISOString().slice(0, 10)
  const [{ data: checkins }, { data: done }] = await Promise.all([
    supabase.from('daily_checkins').select('date, decision').eq('user_id', userId).gte('date', weekStart).lt('date', end),
    supabase.from('completed_sessions').select('date, actual_rpe, actual_type').eq('user_id', userId).gte('date', weekStart).lt('date', end),
  ])
  const map: Record<string, DayStatus> = {}
  for (const c of checkins ?? []) map[c.date] = { decision: c.decision, completed: false, actual_rpe: null, actual_type: null }
  for (const d of done ?? []) {
    map[d.date] = { ...(map[d.date] ?? { decision: null }), completed: true, actual_rpe: d.actual_rpe, actual_type: d.actual_type }
  }
  return map
}
