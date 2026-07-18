export interface DailyStat {
  hrv: number | null
  resting_hr: number | null
  sleep_hours: number | null
}
export interface Baseline {
  hrv: number | null
  resting_hr: number | null
  sleep_hours: number | null
}
export interface Deltas {
  hrv_delta: number | null
  rhr_delta: number | null
  sleep_delta: number | null
}
export interface LoadEntry {
  date: string
  load: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

function avg(nums: (number | null)[]): number | null {
  const v = nums.filter((n): n is number => n != null)
  if (!v.length) return null
  return round1(v.reduce((a, b) => a + b, 0) / v.length)
}

export function computeBaseline(recent: DailyStat[]): Baseline {
  return {
    hrv: avg(recent.map((r) => r.hrv)),
    resting_hr: avg(recent.map((r) => r.resting_hr)),
    sleep_hours: avg(recent.map((r) => r.sleep_hours)),
  }
}

export function computeDeltas(today: DailyStat, baseline: Baseline): Deltas {
  const d = (t: number | null, b: number | null) => (t != null && b != null ? round1(t - b) : null)
  return {
    hrv_delta: d(today.hrv, baseline.hrv),
    rhr_delta: d(today.resting_hr, baseline.resting_hr),
    sleep_delta: d(today.sleep_hours, baseline.sleep_hours),
  }
}

export function computeACWR(loads: LoadEntry[], todayISO: string): number | null {
  const today = Date.parse(todayISO)
  const daysAgo = (d: string) => (today - Date.parse(d)) / 86_400_000
  const inWindow = (d: string, days: number) => {
    const diff = daysAgo(d)
    return diff >= 0 && diff < days
  }
  const acute = loads.filter((l) => inWindow(l.date, 7)).reduce((a, b) => a + b.load, 0)
  const chronicTotal = loads.filter((l) => inWindow(l.date, 28)).reduce((a, b) => a + b.load, 0)
  const chronicWeekly = chronicTotal / 4
  if (chronicWeekly === 0) return null
  return Math.round((acute / chronicWeekly) * 100) / 100
}
