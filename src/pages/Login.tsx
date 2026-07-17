import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Button, Card, Input } from '../components/ui'

export default function Login() {
  const nav = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const fn =
      mode === 'signin'
        ? supabase.auth.signInWithPassword({ email, password })
        : supabase.auth.signUp({ email, password })
    const { error } = await fn
    setBusy(false)
    if (error) return setError(error.message)
    nav('/', { replace: true })
  }

  return (
    <div className="grid min-h-full place-items-center p-6">
      <Card className="w-full max-w-sm">
        <h1 className="mb-1 text-2xl font-semibold">Squash Coach</h1>
        <p className="mb-6 text-sm text-muted">
          {mode === 'signin' ? 'Sign in to your training log.' : 'Create your account.'}
        </p>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <Input
            id="email" label="Email" type="email" autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} required
          />
          <Input
            id="password" label="Password" type="password"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Sign up'}
          </Button>
        </form>
        <button
          className="mt-4 text-sm text-muted hover:text-text"
          onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        >
          {mode === 'signin' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
        </button>
      </Card>
    </div>
  )
}
