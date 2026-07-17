import { supabase } from './supabase'
import { buildMacrocycle } from './macrocycle'
import { todayISO } from './dates'

export type Playstyle = 'attacking' | 'retrieving' | 'all_court'
export type GymAccess = 'full' | 'bodyweight' | 'none'

/** The editable athlete profile — mirrors the `profiles` table (minus system columns). */
export interface ProfileData {
  playstyle: Playstyle | null
  us_squash_rating: number | null
  level_descriptor: string | null
  years_playing: number | null
  weekly_oncourt_hours: number | null
  strength_experience: string | null
  days_per_week: number | null
  avg_session_min: number | null
  schedule_flexibility: string | null
  has_partner_default: boolean
  gym_access: GymAccess
  goal_type: string | null
  goal_target_date: string | null
  injuries: string[]
  focus_areas: string[]
  recent_context: string | null
  season_status: string | null
}

export const EMPTY_PROFILE: ProfileData = {
  playstyle: null,
  us_squash_rating: null,
  level_descriptor: null,
  years_playing: null,
  weekly_oncourt_hours: null,
  strength_experience: null,
  days_per_week: null,
  avg_session_min: null,
  schedule_flexibility: 'flexible',
  has_partner_default: true,
  gym_access: 'full',
  goal_type: null,
  goal_target_date: null,
  injuries: [],
  focus_areas: [],
  recent_context: null,
  season_status: 'general',
}

export const SEASON_OPTIONS = [
  { value: 'off_season', label: 'Off-season (base building)' },
  { value: 'pre_season', label: 'Pre-season (ramping up)' },
  { value: 'in_season', label: 'In-season (competing)' },
  { value: 'injury_return', label: 'Returning from injury/break' },
  { value: 'general', label: 'General / no set season' },
] as const

/** Load the current user's profile fields into a ProfileData shape (nulls if unset). */
export async function loadProfile(userId: string): Promise<ProfileData> {
  const { data, error } = await supabase
    .from('profiles')
    .select(
      'playstyle, us_squash_rating, level_descriptor, years_playing, weekly_oncourt_hours, strength_experience, days_per_week, avg_session_min, schedule_flexibility, has_partner_default, gym_access, goal_type, goal_target_date, injuries, focus_areas, recent_context, season_status',
    )
    .eq('id', userId)
    .single()
  if (error) throw error
  return {
    ...EMPTY_PROFILE,
    ...data,
    injuries: (data?.injuries as string[]) ?? [],
    focus_areas: (data?.focus_areas as string[]) ?? [],
  }
}

/** Update profile fields only (used by the Profile edit page). */
export async function updateProfile(userId: string, p: ProfileData): Promise<void> {
  const { error } = await supabase.from('profiles').update(p).eq('id', userId)
  if (error) throw error
}

/**
 * Onboarding submit: save the profile fields, create the macrocycle, and only then
 * mark onboarding complete.
 *
 * Ordering matters for robustness: the macrocycle is inserted BEFORE `onboarding_complete`
 * is flipped, so a failure at any earlier step leaves the user still un-onboarded (the gate
 * keeps them in this flow to retry) rather than stranded as "onboarded" with no training block.
 * Re-runs replace any prior macrocycle: we insert the new one first, then delete the others,
 * so a failed insert never wipes an existing block.
 */
export async function saveOnboarding(userId: string, p: ProfileData): Promise<void> {
  // 1. Save profile fields (but NOT onboarding_complete yet).
  const { error: pErr } = await supabase.from('profiles').update(p).eq('id', userId)
  if (pErr) throw pErr

  // 2. Insert the new macrocycle and capture its id.
  const start = todayISO()
  const m = buildMacrocycle(start, p.goal_target_date)
  const { data: inserted, error: mErr } = await supabase
    .from('macrocycles')
    .insert({
      user_id: userId,
      start_date: m.start_date,
      end_date: m.end_date,
      block_type: m.block_type,
      phases: m.phases,
    })
    .select('id')
    .single()
  if (mErr) throw mErr

  // 3. Drop any older macrocycles for this user (keep only the one just inserted).
  await supabase.from('macrocycles').delete().eq('user_id', userId).neq('id', inserted.id)

  // 4. Finally flip the gate — everything above succeeded.
  const { error: cErr } = await supabase
    .from('profiles')
    .update({ onboarding_complete: true })
    .eq('id', userId)
  if (cErr) throw cErr
}

/** Load the user's macrocycle (or null). */
export async function loadMacrocycle(userId: string) {
  const { data } = await supabase
    .from('macrocycles')
    .select('start_date, end_date, block_type, phases')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}
