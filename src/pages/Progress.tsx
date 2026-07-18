import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../auth/useSession'
import { loadWeekProgress, loadRpeSeries, type RpePoint } from '../lib/progress'
import type { WeekProgress } from '../lib/progressStats'
import { WeeklySummary } from '../components/WeeklySummary'
import { RpeTrend } from '../components/RpeTrend'
import { Card } from '../components/ui'

export default function Progress() {
  const { session } = useSession()
  const uid = session?.user?.id
  const [summary, setSummary] = useState<WeekProgress | null>(null)
  const [points, setPoints] = useState<RpePoint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    Promise.all([loadWeekProgress(uid), loadRpeSeries(uid)])
      .then(([w, s]) => {
        setSummary(w.summary)
        setPoints(s)
      })
      .finally(() => setLoading(false))
  }, [uid])

  if (loading) return <Card><p className="text-muted">Loading…</p></Card>

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Progress</h1>
      {summary && <WeeklySummary summary={summary} />}
      <RpeTrend points={points} />
      <Card>
        <p className="text-sm text-muted">
          Reviewing your notes? Your full training diary is in the{' '}
          <Link to="/journal" className="text-accent">Journal</Link>.
        </p>
      </Card>
    </div>
  )
}
