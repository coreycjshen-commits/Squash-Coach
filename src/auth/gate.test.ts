import { describe, it, expect } from 'vitest'
import { resolveGate } from './gate'

describe('resolveGate', () => {
  it('sends unauthenticated users to /login', () => {
    expect(resolveGate({ hasSession: false, onboardingComplete: false, path: '/' }))
      .toEqual({ redirect: '/login' })
  })

  it('sends authed-but-not-onboarded users to /onboarding', () => {
    expect(resolveGate({ hasSession: true, onboardingComplete: false, path: '/' }))
      .toEqual({ redirect: '/onboarding' })
  })

  it('lets an onboarded user through', () => {
    expect(resolveGate({ hasSession: true, onboardingComplete: true, path: '/' }))
      .toEqual({ redirect: null })
  })

  it('does not loop: an un-onboarded user already on /onboarding is allowed', () => {
    expect(resolveGate({ hasSession: true, onboardingComplete: false, path: '/onboarding' }))
      .toEqual({ redirect: null })
  })

  it('bounces an onboarded user off /onboarding back to home', () => {
    expect(resolveGate({ hasSession: true, onboardingComplete: true, path: '/onboarding' }))
      .toEqual({ redirect: '/' })
  })
})
