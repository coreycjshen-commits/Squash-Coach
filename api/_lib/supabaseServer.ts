import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Build a Supabase client bound to the caller's access token so RLS applies server-side.
 * Returns null if the Authorization header is missing/malformed.
 */
export function clientFromRequest(authHeader: string | undefined): SupabaseClient | null {
  if (!authHeader?.startsWith('Bearer ')) return null
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const anon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !anon) throw new Error('Supabase env vars missing on server')
  return createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
