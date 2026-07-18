import { useEffect, useState } from 'react'
import { useSession } from '../auth/useSession'
import { loadJournal, type JournalEntry } from '../lib/journal'
import { Card, Input } from '../components/ui'

export default function Journal() {
  const { session } = useSession()
  const uid = session?.user?.id
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!uid) return
    const t = setTimeout(() => {
      loadJournal(uid, query).then(setEntries).finally(() => setLoading(false))
    }, query ? 250 : 0)
    return () => clearTimeout(t)
  }, [uid, query])

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Journal</h1>
      <Input
        type="search"
        placeholder="Search your notes…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {loading && <Card><p className="text-muted">Loading…</p></Card>}
      {!loading && entries.length === 0 && (
        <Card><p className="text-muted">{query ? 'No entries match that search.' : 'No journal entries yet — they come from your daily check-ins.'}</p></Card>
      )}
      {entries.map((e) => (
        <Card key={e.id}>
          <p className="text-xs font-medium uppercase tracking-wide text-accent">{e.date}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-text">{e.body}</p>
        </Card>
      ))}
    </div>
  )
}
