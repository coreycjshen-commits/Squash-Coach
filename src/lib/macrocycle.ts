import { weeksBetween, addWeeks } from './dates'

export type BlockType = 'fixed_goal' | 'rolling'
export interface Phase {
  name: string
  start_week: number
  end_week: number
}
export interface Macrocycle {
  start_date: string
  end_date: string | null
  block_type: BlockType
  phases: Phase[]
}

const FULL_NAMES = [
  'General Prep',
  'Specific Prep',
  'Pre-Competitive / Power',
  'Competition / Maintenance',
] as const
const FULL_PROPORTIONS = [0.35, 0.3, 0.2, 0.15]

const ROLLING_WEEKS = 10
const ROLLING_NAMES = ['General Prep', 'Specific Prep', 'Pre-Competitive / Power']
const ROLLING_COUNTS = [4, 4, 2]

/** Distribute `total` across `proportions` with each part >= 1, using largest-remainder. */
function distribute(total: number, proportions: number[]): number[] {
  const n = proportions.length
  const raw = proportions.map((p) => p * total)
  const floors = raw.map((x) => Math.max(1, Math.floor(x)))
  let sum = floors.reduce((a, b) => a + b, 0)
  while (sum > total) {
    let idx = 0
    for (let i = 1; i < n; i++) if (floors[i] > floors[idx]) idx = i
    if (floors[idx] <= 1) break
    floors[idx]--
    sum--
  }
  const remainders = raw
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac)
  let k = 0
  while (sum < total) {
    floors[remainders[k % n].i]++
    sum++
    k++
  }
  return floors
}

function toPhases(names: readonly string[], counts: number[]): Phase[] {
  const phases: Phase[] = []
  let week = 1
  names.forEach((name, i) => {
    const len = counts[i]
    phases.push({ name, start_week: week, end_week: week + len - 1 })
    week += len
  })
  return phases
}

export function buildMacrocycle(startISO: string, goalISO: string | null): Macrocycle {
  if (!goalISO) {
    return {
      start_date: startISO,
      end_date: addWeeks(startISO, ROLLING_WEEKS),
      block_type: 'rolling',
      phases: toPhases(ROLLING_NAMES, ROLLING_COUNTS),
    }
  }

  const totalWeeks = Math.max(1, weeksBetween(startISO, goalISO))
  if (totalWeeks < 4) {
    return {
      start_date: startISO,
      end_date: goalISO,
      block_type: 'fixed_goal',
      phases: [{ name: 'Competition / Maintenance', start_week: 1, end_week: totalWeeks }],
    }
  }

  const counts = distribute(totalWeeks, FULL_PROPORTIONS)
  return {
    start_date: startISO,
    end_date: goalISO,
    block_type: 'fixed_goal',
    phases: toPhases(FULL_NAMES, counts),
  }
}

/** The phase containing `todayISO`, clamped to the first/last phase outside the block. */
export function currentPhase(m: Macrocycle, todayISO: string): Phase {
  const week = weeksBetween(m.start_date, todayISO) + 1
  const first = m.phases[0]
  const last = m.phases[m.phases.length - 1]
  if (week <= first.start_week) return first
  const hit = m.phases.find((p) => week >= p.start_week && week <= p.end_week)
  return hit ?? last
}
