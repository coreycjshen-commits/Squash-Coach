import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const tabs = [
  { to: '/', label: 'Today' },
  { to: '/week', label: 'Week' },
  { to: '/coach', label: 'Coach' },
  { to: '/journal', label: 'Journal' },
  { to: '/progress', label: 'Progress' },
  { to: '/profile', label: 'Profile' },
]

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col md:flex-row">
      <aside className="hidden border-r border-border p-4 md:block md:w-48">
        <div className="mb-8 px-2 text-lg font-semibold">Squash Coach</div>
        <nav className="flex flex-col gap-1">
          {tabs.map((t) => (
            <NavItem key={t.to} {...t} />
          ))}
        </nav>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-8 px-2 text-sm text-muted hover:text-text"
        >
          Sign out
        </button>
      </aside>

      <main className="flex-1 p-4 pb-24 md:pb-4">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-border bg-surface/95 py-2 backdrop-blur md:hidden">
        {tabs.map((t) => (
          <NavItem key={t.to} {...t} compact />
        ))}
      </nav>
    </div>
  )
}

function NavItem({ to, label, compact }: { to: string; label: string; compact?: boolean }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `rounded-lg px-3 py-2 text-sm font-medium transition ${
          isActive ? 'text-accent' : 'text-muted hover:text-text'
        } ${compact ? 'text-center' : ''}`
      }
    >
      {label}
    </NavLink>
  )
}
