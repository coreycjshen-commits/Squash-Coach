import type { ProfileData } from '../lib/profile'
import type { RadioOption } from '../components/ui'

export const PLAYSTYLE_OPTIONS: RadioOption[] = [
  {
    value: 'attacking',
    label: 'Attacking / shot-maker',
    description: 'You look to finish rallies early — kills, nicks, and short deception to take time away.',
  },
  {
    value: 'retrieving',
    label: 'Retrieving / counter-attacker',
    description: 'You defend deep, run everything down, and win by extending rallies and forcing errors.',
  },
  {
    value: 'all_court',
    label: 'All-court / balanced',
    description: 'You mix attack and defense, adapting shot selection to the situation.',
  },
]

export const GYM_OPTIONS: RadioOption[] = [
  { value: 'full', label: 'Full weight room', description: 'Barbells, dumbbells, racks.' },
  { value: 'bodyweight', label: 'Bodyweight / minimal', description: 'Bands, light dumbbells, no rack.' },
  { value: 'none', label: 'No gym access', description: 'Court and open space only.' },
]

export interface StepDef {
  id: string
  title: string
  subtitle: string
  validate: (d: ProfileData) => string | null
}

export const STEPS: StepDef[] = [
  {
    id: 'playstyle',
    title: 'How do you play?',
    subtitle: 'Pick the style that fits you best — the plan leans your training toward it.',
    validate: (d) => (d.playstyle ? null : 'Pick a playstyle to continue.'),
  },
  {
    id: 'level',
    title: 'Your level',
    subtitle:
      'US Squash rating runs ~1.0 (beginner) to 7.5+ (world class); the average adult is ~3.5. No rating? Describe your level instead.',
    validate: (d) =>
      d.us_squash_rating != null || (d.level_descriptor && d.level_descriptor.trim())
        ? null
        : 'Enter a rating or a short level description.',
  },
  {
    id: 'history',
    title: 'Training history',
    subtitle: 'Roughly how much you already train.',
    validate: (d) => (d.years_playing != null ? null : 'How many years have you played?'),
  },
  {
    id: 'availability',
    title: 'Weekly availability',
    subtitle: 'How much time you can commit in a normal week.',
    validate: (d) =>
      d.days_per_week && d.avg_session_min ? null : 'Set your days per week and session length.',
  },
  {
    id: 'access',
    title: 'Access',
    subtitle: 'What you can reliably get to — the plan adapts if you often train solo.',
    validate: () => null,
  },
  {
    id: 'goals',
    title: 'Goals',
    subtitle: 'What are you training toward? A target date sharpens the periodization.',
    validate: (d) => (d.goal_type && d.goal_type.trim() ? null : 'Tell me what you’re aiming for.'),
  },
  {
    id: 'injuries',
    title: 'Injuries & niggles',
    subtitle: 'Anything to build around or avoid loading. Leave blank if none.',
    validate: () => null,
  },
]
