import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Button, Card, Input, Select, Textarea, Field, RadioCards } from '../components/ui'
import { EMPTY_PROFILE, saveOnboarding, SEASON_OPTIONS, type ProfileData } from '../lib/profile'
import { useSession } from '../auth/useSession'
import { STEPS, PLAYSTYLE_OPTIONS, GYM_OPTIONS } from './steps'

/** Parse a number input into number | null (empty -> null). */
function num(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function OnboardingForm() {
  const nav = useNavigate()
  const { session, refreshProfile } = useSession()
  const [data, setData] = useState<ProfileData>(EMPTY_PROFILE)
  const [stepIdx, setStepIdx] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const step = STEPS[stepIdx]
  const isLast = stepIdx === STEPS.length - 1
  const set = (patch: Partial<ProfileData>) => setData((d) => ({ ...d, ...patch }))

  async function next() {
    const err = step.validate(data)
    if (err) return setError(err)
    setError(null)
    if (!isLast) return setStepIdx((i) => i + 1)

    if (!session?.user) return setError('Your session expired — please sign in again.')
    setBusy(true)
    try {
      await saveOnboarding(session.user.id, data)
      await refreshProfile()
      nav('/', { replace: true })
    } catch (e) {
      setBusy(false)
      setError(e instanceof Error ? e.message : 'Could not save your profile.')
    }
  }

  function back() {
    setError(null)
    setStepIdx((i) => Math.max(0, i - 1))
  }

  return (
    <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center p-6">
      <div className="mb-6 flex gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <div
            key={s.id}
            className={`h-1 flex-1 rounded-full ${i <= stepIdx ? 'bg-accent' : 'bg-border'}`}
          />
        ))}
      </div>

      <Card>
        <p className="text-xs font-medium uppercase tracking-wide text-muted">
          Step {stepIdx + 1} of {STEPS.length}
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{step.title}</h1>
        <p className="mt-1.5 text-sm text-muted">{step.subtitle}</p>

        <AnimatePresence mode="wait">
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="mt-6 flex flex-col gap-5"
          >
            {step.id === 'playstyle' && (
              <RadioCards
                name="playstyle"
                options={PLAYSTYLE_OPTIONS}
                value={data.playstyle}
                onChange={(v) => set({ playstyle: v as ProfileData['playstyle'] })}
              />
            )}

            {step.id === 'level' && (
              <>
                <Field label="US Squash rating" hint="Optional — leave blank if you don't have one." htmlFor="rating">
                  <Input
                    id="rating" type="number" step="0.1" min="1" max="8"
                    placeholder="e.g. 4.5"
                    value={data.us_squash_rating ?? ''}
                    onChange={(e) => set({ us_squash_rating: num(e.target.value) })}
                  />
                </Field>
                <Field label="Or describe your level" hint="PSA / college / club, national junior background, etc." htmlFor="leveldesc">
                  <Input
                    id="leveldesc" type="text"
                    placeholder="e.g. college varsity, former national junior"
                    value={data.level_descriptor ?? ''}
                    onChange={(e) => set({ level_descriptor: e.target.value })}
                  />
                </Field>
              </>
            )}

            {step.id === 'history' && (
              <>
                <Field label="Years playing" htmlFor="years">
                  <Input id="years" type="number" step="0.5" min="0" placeholder="e.g. 8"
                    value={data.years_playing ?? ''} onChange={(e) => set({ years_playing: num(e.target.value) })} />
                </Field>
                <Field label="Current on-court hours / week" htmlFor="oncourt">
                  <Input id="oncourt" type="number" step="0.5" min="0" placeholder="e.g. 5"
                    value={data.weekly_oncourt_hours ?? ''} onChange={(e) => set({ weekly_oncourt_hours: num(e.target.value) })} />
                </Field>
                <Field label="Strength-training experience" htmlFor="strength">
                  <Select id="strength" value={data.strength_experience ?? ''}
                    onChange={(e) => set({ strength_experience: e.target.value })}>
                    <option value="">Select…</option>
                    <option value="none">None</option>
                    <option value="beginner">Beginner (&lt;1 yr)</option>
                    <option value="intermediate">Intermediate (1–3 yrs)</option>
                    <option value="advanced">Advanced (3+ yrs)</option>
                  </Select>
                </Field>
              </>
            )}

            {step.id === 'availability' && (
              <>
                <Field label="Training days per week" htmlFor="days">
                  <Select id="days" value={data.days_per_week ?? ''}
                    onChange={(e) => set({ days_per_week: num(e.target.value) })}>
                    <option value="">Select…</option>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
                  </Select>
                </Field>
                <Field label="Average session length (minutes)" htmlFor="sesslen">
                  <Input id="sesslen" type="number" step="15" min="15" placeholder="e.g. 60"
                    value={data.avg_session_min ?? ''} onChange={(e) => set({ avg_session_min: num(e.target.value) })} />
                </Field>
                <Field label="Is your schedule fixed or flexible?" htmlFor="flex">
                  <Select id="flex" value={data.schedule_flexibility ?? 'flexible'}
                    onChange={(e) => set({ schedule_flexibility: e.target.value })}>
                    <option value="flexible">Flexible — I can move sessions around</option>
                    <option value="fixed">Fixed — specific days/times each week</option>
                  </Select>
                </Field>
              </>
            )}

            {step.id === 'access' && (
              <>
                <Field label="Do you usually have a hitting partner / coach?">
                  <div className="flex gap-2">
                    <Button type="button" variant={data.has_partner_default ? 'primary' : 'secondary'}
                      onClick={() => set({ has_partner_default: true })}>Usually yes</Button>
                    <Button type="button" variant={!data.has_partner_default ? 'primary' : 'secondary'}
                      onClick={() => set({ has_partner_default: false })}>Often solo</Button>
                  </div>
                </Field>
                <Field label="Gym access">
                  <RadioCards name="gym" options={GYM_OPTIONS} value={data.gym_access}
                    onChange={(v) => set({ gym_access: v as ProfileData['gym_access'] })} />
                </Field>
              </>
            )}

            {step.id === 'context' && (
              <>
                <Field label="What do you want to work on?" hint="One per line — e.g. backhand length, deception, fitness in long rallies." htmlFor="focus">
                  <Textarea id="focus"
                    placeholder={'straight-drive length\nmovement to the front\nfitness for long matches'}
                    value={data.focus_areas.join('\n')}
                    onChange={(e) => set({ focus_areas: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                  />
                </Field>
                <Field label="Where are you in your season?" htmlFor="season">
                  <Select id="season" value={data.season_status ?? 'general'}
                    onChange={(e) => set({ season_status: e.target.value })}>
                    {SEASON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </Select>
                </Field>
                <Field label="Recent training & anything going on" hint="What you've been doing lately, breaks, niggles, life context — anything the coach should know." htmlFor="recent">
                  <Textarea id="recent"
                    placeholder="e.g. took 3 weeks off for exams, just getting back into it; playing club matches on weekends"
                    value={data.recent_context ?? ''}
                    onChange={(e) => set({ recent_context: e.target.value || null })}
                  />
                </Field>
              </>
            )}

            {step.id === 'goals' && (
              <>
                <Field label="What are you training toward?" htmlFor="goal">
                  <Input id="goal" type="text"
                    placeholder="e.g. peak for college season, off-season base, injury return"
                    value={data.goal_type ?? ''} onChange={(e) => set({ goal_type: e.target.value })} />
                </Field>
                <Field label="Target date" hint="Optional — if you're peaking for something. Blank = rolling block." htmlFor="goaldate">
                  <Input id="goaldate" type="date"
                    value={data.goal_target_date ?? ''} onChange={(e) => set({ goal_target_date: e.target.value || null })} />
                </Field>
              </>
            )}

            {step.id === 'injuries' && (
              <Field label="Injuries or niggles" hint="One per line. The plan will avoid loading these." htmlFor="inj">
                <Textarea id="inj"
                  placeholder={'e.g. right knee tendinitis\nleft shoulder impingement'}
                  value={data.injuries.join('\n')}
                  onChange={(e) => set({ injuries: e.target.value.split('\n').map((s) => s.trim()).filter(Boolean) })}
                />
              </Field>
            )}
          </motion.div>
        </AnimatePresence>

        {error && <p className="mt-4 text-sm text-red-400">{error}</p>}

        <div className="mt-8 flex items-center justify-between">
          <Button type="button" variant="ghost" onClick={back} disabled={stepIdx === 0 || busy}>
            Back
          </Button>
          <Button type="button" onClick={next} disabled={busy}>
            {busy ? 'Saving…' : isLast ? 'Finish & build my plan' : 'Next'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
