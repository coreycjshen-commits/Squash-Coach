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
      <aside className="sticky top-0 hidden h-screen shrink-0 border-r border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl md:block md:w-52">
        <div className="mb-10 px-2 pt-2 font-display text-2xl font-bold uppercase leading-none tracking-[0.14em]">
          Squash<br /><span className="text-accent">Coach</span>
        </div>
        <nav className="flex flex-col gap-1.5">
          {tabs.map((t) => (
            <NavItem key={t.to} {...t} />
          ))}
        </nav>
        <button
          onClick={() => supabase.auth.signOut()}
          className="mt-10 px-3 font-display text-xs uppercase tracking-[0.15em] text-muted hover:text-text"
        >
          Sign out
        </button>
      </aside>

      <main className="flex-1 p-4 pb-28 md:pb-6">{children}</main>

      <nav className="glass fixed inset-x-0 bottom-0 z-10 flex justify-around rounded-none py-2 md:hidden">
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
        `rounded-lg px-3 py-2 font-display text-[11px] font-semibold uppercase tracking-[0.15em] transition ${
          isActive ? 'bg-white/10 text-accent' : 'text-muted hover:bg-white/5 hover:text-text'
        } ${compact ? 'text-center' : ''}`
      }
    >
      {label}
    </NavLink>
  )
}
