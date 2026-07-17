const MS_PER_DAY = 86_400_000

/** Monday (ISO week start) for the given YYYY-MM-DD, as YYYY-MM-DD. */
export function startOfWeekISO(dateISO: string): string {
  const t = Date.parse(dateISO)
  const dow = new Date(t).getUTCDay() // 0=Sun..6=Sat
  const backToMonday = (dow + 6) % 7 // Mon->0, Sun->6
  return new Date(t - backToMonday * MS_PER_DAY).toISOString().slice(0, 10)
}
