import { supabase } from './supabase'
import { startOfWeekISO } from './week'
import { todayISO, addWeeks } from './dates'
import { summarizeWeek, type WeekProgress } from './progressStats'

export interface RpePoint { date: string; rpe: number; type: string | null }

/** Aggregate this week's planned vs completed + adjustments. */
export async function loadWeekProgress(userId: string): Promise<{ weekStart: string; summary: WeekProgress }> {
  const weekStart = startOfWeekISO(todayISO())
  const end = addWeeks(weekStart, 1)

  const { data: plan } = await supabase
    .from('weekly_plans').select('id').eq('user_id', userId).eq('week_start', weekStart).maybeSingle()
  let plannedCount = 0
  if (plan) {
    const { count } = await supabase
      .from('sessions').select('id', { count: 'exact', head: true }).eq('weekly_plan_id', plan.id).neq('type', 'rest')
    plannedCount = count ?? 0
  }

  const { data: completions } = await supabase
    .from('completed_sessions').select('actual_rpe, actual_type')
    .eq('user_id', userId).gte('date', weekStart).lt('date', end)

  const { data: decisions } = await supabase
    .from('daily_checkins').select('date, decision')
    .eq('user_id', userId).gte('date', weekStart).lt('date', end).order('date')

  const summary = summarizeWeek({
    plannedCount,
    completions: (completions ?? []).map((c) => ({ actual_rpe: c.actual_rpe, actual_type: c.actual_type })),
    decisions: (decisions ?? []).map((d) => ({ date: d.date, decision: d.decision })),
  })
  return { weekStart, summary }
}

/** Trailing series of actual RPE from logged sessions (most recent last). */
export async function loadRpeSeries(userId: string, days = 21): Promise<RpePoint[]> {
  const fromDate = new Date(Date.parse(todayISO()) - days * 86_400_000).toISOString().slice(0, 10)
  const { data } = await supabase
    .from('completed_sessions').select('date, actual_rpe, actual_type')
    .eq('user_id', userId).gte('date', fromDate).order('date', { ascending: true })
  return (data ?? [])
    .filter((r) => r.actual_rpe != null)
    .map((r) => ({ date: r.date, rpe: r.actual_rpe as number, type: r.actual_type }))
}
