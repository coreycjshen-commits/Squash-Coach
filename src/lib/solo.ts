export type SoloFocus = 'movement' | 'fitness' | 'touch' | 'mixed'

export interface SoloDrill {
  id: string
  focus: SoloFocus
  name: string
  structure: Record<string, unknown>
  target_intensity: number | null
  duration_min: number | null
  equivalent_for: string
}

export interface PlannedLike {
  type: string
  focus: string | null
  target_rpe: number | null
  duration_min: number | null
}

const KEYWORDS: Record<SoloFocus, string[]> = {
  touch: ['touch', 'drop', 'rail', 'length', 'drive', 'accuracy', 'technical', 'precision', 'kill'],
  movement: ['movement', 'ghost', 'footwork', 'sprint', 'corner', 'front', 'court movement'],
  fitness: ['fitness', 'interval', 'conditioning', 'repeated', 'capacity', 'aerobic', 'cardio'],
  mixed: ['match', 'game', 'pressure', 'condition game', 'strategy'],
}

export function inferFocus(session: PlannedLike): SoloFocus {
  const text = `${session.focus ?? ''}`.toLowerCase()
  let best: SoloFocus = 'mixed'
  let bestScore = 0
  for (const f of ['movement', 'fitness', 'touch', 'mixed'] as SoloFocus[]) {
    const score = KEYWORDS[f].reduce((n, k) => n + (text.includes(k) ? 1 : 0), 0)
    if (score > bestScore) {
      best = f
      bestScore = score
    }
  }
  return bestScore > 0 ? best : 'mixed'
}

export function pickSoloDrill(session: PlannedLike, drills: SoloDrill[]): SoloDrill | null {
  if (!drills.length) return null
  const focus = inferFocus(session)
  const targetRpe = session.target_rpe ?? 6
  const oncourt = drills.filter((d) => d.equivalent_for === 'oncourt')
  const candidates = oncourt.length ? oncourt : drills
  const matched = candidates.filter((d) => d.focus === focus)
  const pool = matched.length ? matched : candidates
  return [...pool].sort((a, b) => {
    const da = Math.abs((a.target_intensity ?? 6) - targetRpe)
    const db = Math.abs((b.target_intensity ?? 6) - targetRpe)
    return da - db || a.name.localeCompare(b.name)
  })[0]
}
