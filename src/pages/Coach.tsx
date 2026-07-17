import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../auth/useSession'
import { loadCoachMessages, sendCoachMessage, type CoachMessage } from '../lib/coach'
import { generateWeek } from '../lib/plans'
import { Button } from '../components/ui'

export default function Coach() {
  const { session } = useSession()
  const uid = session?.user?.id
  const [messages, setMessages] = useState<CoachMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [building, setBuilding] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const nav = useNavigate()

  useEffect(() => {
    if (uid) loadCoachMessages(uid).then(setMessages).catch(() => {})
  }, [uid])

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  async function send() {
    const text = input.trim()
    if (!text || sending) return
    setInput('')
    setError(null)
    setSending(true)
    const optimistic: CoachMessage = { id: `tmp-${messages.length}`, role: 'user', content: text, created_at: '' }
    setMessages((m) => [...m, optimistic])
    const r = await sendCoachMessage(text)
    setSending(false)
    if (r.error) return setError(r.error)
    if (uid) setMessages(await loadCoachMessages(uid))
  }

  async function buildWeek() {
    setBuilding(true)
    setNote(null)
    const r = await generateWeek()
    setBuilding(false)
    if (!r.ok) return setError(r.error ?? 'Could not update the week')
    setNote('Your week has been updated from this conversation.')
    setTimeout(() => nav('/week'), 900)
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-3 md:h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Coach</h1>
        <Button variant="secondary" onClick={buildWeek} disabled={building}>
          {building ? 'Updating…' : 'Update my week'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto rounded-2xl border border-border bg-surface p-4">
        {messages.length === 0 && (
          <p className="text-sm text-muted">
            Talk to your coach — what you want to work on, how you're feeling, whether to push or ease off.
            When you're aligned, hit “Update my week”.
          </p>
        )}
        <div className="flex flex-col gap-3">
          {messages.map((m) => (
            <div key={m.id} className={m.role === 'user' ? 'self-end' : 'self-start'}>
              <div className={`max-w-[80vw] rounded-2xl px-4 py-2.5 text-sm md:max-w-md ${
                m.role === 'user' ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-text'
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {sending && <div className="self-start rounded-2xl bg-surface-2 px-4 py-2.5 text-sm text-muted">Coach is thinking…</div>}
          <div ref={endRef} />
        </div>
      </div>

      {note && <p className="text-sm text-accent">{note}</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-2">
        <textarea
          className="min-h-12 flex-1 resize-none rounded-xl border border-border bg-surface-2 px-3.5 py-2.5 text-text outline-none focus:border-accent focus:ring-2 focus:ring-accent/30"
          placeholder="Message your coach…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send() } }}
        />
        <Button onClick={send} disabled={sending || !input.trim()}>Send</Button>
      </div>
    </div>
  )
}
