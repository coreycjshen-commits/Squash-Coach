import { supabase } from './supabase'
import { startOfWeekISO } from './week'
import { todayISO } from './dates'

export interface SessionRow {
  id: string
  day: string
  type: 'oncourt' | 'strength' | 'cardio' | 'rest'
  focus: string | null
  duration_min: number | null
  target_rpe: number | null
  detail: Record<string, unknown>
  order_index: number
}
export interface WeekPlan {
  id: string
  week_start: string
  phase: string | null
  rationale: string | null
  generated_by: string
  sessions: SessionRow[]
}

/** Load the plan for the current week (or null if none yet). */
export async function loadCurrentWeek(userId: string): Promise<WeekPlan | null> {
  const weekStart = startOfWeekISO(todayISO())
  const { data: plan } = await supabase
    .from('weekly_plans')
    .select('id, week_start, phase, rationale, generated_by')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle()
  if (!plan) return null
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, day, type, focus, duration_min, target_rpe, detail, order_index')
    .eq('weekly_plan_id', plan.id)
    .order('order_index', { ascending: true })
  return { ...plan, sessions: (sessions as SessionRow[]) ?? [] }
}

/** Call the serverless generator with the user's access token. */
export async function generateWeek(): Promise<{ ok: boolean; source?: string; error?: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { ok: false, error: 'Not signed in' }
  const res = await fetch('/api/generate-week', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    // Send the client's local week start so the server writes the plan under the same
    // Monday the client queries with (guards the UTC-vs-local Sun→Mon boundary).
    body: JSON.stringify({ weekStart: startOfWeekISO(todayISO()) }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: body.error ?? `Server error ${res.status}` }
  return { ok: true, source: body.source }
}

/** Manual edit of a single planned session. */
export async function updateSession(id: string, patch: Partial<Pick<SessionRow, 'focus' | 'duration_min' | 'target_rpe' | 'type'>>): Promise<void> {
  const { error } = await supabase.from('sessions').update(patch).eq('id', id)
  if (error) throw error
}
