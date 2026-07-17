import { supabase } from './supabase'

export interface CoachMessage {
  id: string
  role: 'user' | 'coach'
  content: string
  created_at: string
}

export async function loadCoachMessages(userId: string): Promise<CoachMessage[]> {
  const { data } = await supabase
    .from('coach_messages')
    .select('id, role, content, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
  return (data as CoachMessage[]) ?? []
}

/** Send a message; the server persists both sides and returns the coach reply. */
export async function sendCoachMessage(message: string): Promise<{ reply?: string; error?: string }> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) return { error: 'Not signed in' }
  const res = await fetch('/api/coach-chat', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return { error: body.error ?? `Server error ${res.status}` }
  return { reply: body.reply }
}
