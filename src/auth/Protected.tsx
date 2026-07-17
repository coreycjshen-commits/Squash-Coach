import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useSession } from './useSession'
import { resolveGate } from './gate'

export function Protected({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useSession()
  const location = useLocation()

  if (loading) {
    return <div className="grid min-h-full place-items-center text-muted">Loading…</div>
  }

  const { redirect } = resolveGate({
    hasSession: !!session,
    onboardingComplete: !!profile?.onboarding_complete,
    path: location.pathname,
  })

  if (redirect && redirect !== location.pathname) {
    return <Navigate to={redirect} replace />
  }
  return <>{children}</>
}
