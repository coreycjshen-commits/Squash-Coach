import { supabase } from './supabase'

export interface JournalEntry {
  id: string
  date: string
  body: string
  created_at: string
}

/** Load journal entries (newest first). If `query` is set, filter by body (case-insensitive). */
export async function loadJournal(userId: string, query?: string): Promise<JournalEntry[]> {
  let q = supabase
    .from('journal_entries').select('id, date, body, created_at')
    .eq('user_id', userId).order('date', { ascending: false }).order('created_at', { ascending: false })
  if (query && query.trim()) q = q.ilike('body', `%${query.trim()}%`)
  const { data } = await q
  return (data as JournalEntry[]) ?? []
}
