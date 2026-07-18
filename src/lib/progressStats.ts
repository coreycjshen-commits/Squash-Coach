export interface WeekProgressInput {
  plannedCount: number
  completions: { actual_rpe: number | null; actual_type: string | null }[]
  decisions: { date: string; decision: string | null }[]
}
export interface WeekProgress {
  planned: number
  completed: number
  adherencePct: number
  avgActualRpe: number | null
  adjustments: { date: string; decision: string }[]
  byType: Record<string, number>
}

export function summarizeWeek(i: WeekProgressInput): WeekProgress {
  const completed = i.completions.length
  const adherencePct = i.plannedCount > 0 ? Math.round((completed / i.plannedCount) * 100) : 0
  const rpes = i.completions.map((c) => c.actual_rpe).filter((n): n is number => n != null)
  const avgActualRpe = rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null
  const adjustments = i.decisions
    .filter((d) => d.decision && d.decision !== 'keep')
    .map((d) => ({ date: d.date, decision: d.decision as string }))
  const byType: Record<string, number> = {}
  for (const c of i.completions) {
    const t = c.actual_type ?? 'other'
    byType[t] = (byType[t] ?? 0) + 1
  }
  return { planned: i.plannedCount, completed, adherencePct, avgActualRpe, adjustments, byType }
}
