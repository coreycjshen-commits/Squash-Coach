const MS_PER_DAY = 86_400_000

/** Whole weeks from start to end, rounding a partial week UP. 0 if end <= start. */
export function weeksBetween(startISO: string, endISO: string): number {
  const start = Date.parse(startISO)
  const end = Date.parse(endISO)
  const days = Math.floor((end - start) / MS_PER_DAY)
  if (days <= 0) return 0
  return Math.ceil(days / 7)
}

/** start + n weeks, as YYYY-MM-DD (UTC-safe). */
export function addWeeks(startISO: string, n: number): string {
  const d = new Date(Date.parse(startISO) + n * 7 * MS_PER_DAY)
  return d.toISOString().slice(0, 10)
}

/** Local calendar date as YYYY-MM-DD. */
export function todayISO(): string {
  const now = new Date()
  const tzOffset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - tzOffset).toISOString().slice(0, 10)
}
