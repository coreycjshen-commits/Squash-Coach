import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useSession } from '../auth/useSession'
import {
  loadProfile, updateProfile, loadMacrocycle, EMPTY_PROFILE, SEASON_OPTIONS, type ProfileData,
} from '../lib/profile'
import { currentPhase, type Macrocycle } from '../lib/macrocycle'
import { todayISO } from '../lib/dates'
import { Button, Card, Input, Field, Textarea, Select } from '../components/ui'

export default function Profile() {
  const { session } = useSession()
  const uid = session?.user?.id
  const [data, setData] = useState<ProfileData>(EMPTY_PROFILE)
  const [macro, setMacro] = useState<Macrocycle | null>(null)
  const [loading, setLoading] = useState(true)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!uid) return
    Promise.all([loadProfile(uid), loadMacrocycle(uid)])
      .then(([p, m]) => {
        setData(p)
        setMacro(m as Macrocycle | null)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profile.'))
      .finally(() => setLoading(false))
  }, [uid])

  async function save() {
    if (!uid) return
    setSaved(false)
    setError(null)
    try {
      await updateProfile(uid, data)
      setSaved(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
    }
  }

  if (loading) return <Card><p className="text-muted">Loading…</p></Card>

  const phase = macro ? currentPhase(macro, todayISO()) : null

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Your profile</h1>
          <Button variant="ghost" onClick={() => supabase.auth.signOut()}>Sign out</Button>
        </div>
      </Card>

      {macro && phase && (
        <Card>
          <h2 className="text-sm font-medium uppercase tracking-wide text-muted">Current training block</h2>
          <p className="mt-1 text-lg font-semibold text-accent">{phase.name}</p>
          <p className="text-sm text-muted">
            {macro.block_type === 'rolling' ? 'Rolling block' : 'Peaking block'} ·
            {' '}{macro.start_date}{macro.end_date ? ` → ${macro.end_date}` : ''}
          </p>
          <div className="mt-3 flex flex-col gap-1">
            {macro.phases.map((p) => (
              <div key={p.name} className={`flex justify-between rounded-lg px-3 py-2 text-sm ${
                p.name === phase.name ? 'bg-accent/10 text-text' : 'text-muted'
              }`}>
                <span>{p.name}</span>
                <span>wk {p.start_week}–{p.end_week}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-4 text-sm font-medium uppercase tracking-wide text-muted">Edit details</h2>
        <div className="flex flex-col gap-4">
          <Field label="US Squash rating" htmlFor="p-rating">
            <Input id="p-rating" type="number" step="0.1" value={data.us_squash_rating ?? ''}
              onChange={(e) => setData({ ...data, us_squash_rating: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Level description" htmlFor="p-level">
            <Input id="p-level" type="text" value={data.level_descriptor ?? ''}
              onChange={(e) => setData({ ...data, level_descriptor: e.target.value })} />
          </Field>
          <Field label="Training days per week" htmlFor="p-days">
            <Input id="p-days" type="number" min="1" max="7" value={data.days_per_week ?? ''}
              onChange={(e) => setData({ ...data, days_per_week: e.target.value === '' ? null : Number(e.target.value) })} />
          </Field>
          <Field label="Goal" htmlFor="p-goal">
            <Input id="p-goal" type="text" value={data.goal_type ?? ''}
              onChange={(e) => setData({ ...data, goal_type: e.target.value })} />
          </Field>
          <Field label="Injuries (one per line)" htmlFor="p-inj">
            <Input id="p-inj" type="text" value={data.injuries.join(', ')}
              onChange={(e) => setData({ ...data, injuries: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
          </Field>
          <Field label="What you want to work on (one per line)" htmlFor="p-focus">
            <Textarea id="p-focus" value={data.focus_areas.join('\n')}
              onChange={(e) => setData({ ...data, focus_areas: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })} />
          </Field>
          <Field label="Season" htmlFor="p-season">
            <Select id="p-season" value={data.season_status ?? 'general'}
              onChange={(e) => setData({ ...data, season_status: e.target.value })}>
              {SEASON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Field>
          <Field label="Recent training & context" htmlFor="p-recent">
            <Textarea id="p-recent" value={data.recent_context ?? ''}
              onChange={(e) => setData({ ...data, recent_context: e.target.value || null })} />
          </Field>
        </div>
        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}
        {saved && <p className="mt-4 text-sm text-accent">Saved.</p>}
        <div className="mt-6">
          <Button onClick={save}>Save changes</Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Changing your goal date won't rebuild your training block automatically — re-run onboarding for that.
        </p>
      </Card>
    </div>
  )
}
