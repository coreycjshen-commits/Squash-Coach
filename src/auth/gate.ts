export interface GateInput {
  hasSession: boolean
  onboardingComplete: boolean
  path: string
}
export interface GateResult {
  redirect: string | null
}

export function resolveGate({ hasSession, onboardingComplete, path }: GateInput): GateResult {
  if (!hasSession) return { redirect: '/login' }
  if (!onboardingComplete) {
    return { redirect: path === '/onboarding' ? null : '/onboarding' }
  }
  if (path === '/onboarding') return { redirect: '/' }
  return { redirect: null }
}
