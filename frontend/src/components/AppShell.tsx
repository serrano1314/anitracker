import { useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { PageTransition } from './PageTransition'
import { ProfileAvatar } from './ProfileAvatar'
import { ProfileModal } from './ProfileModal'
import { useAuth } from '../auth/AuthProvider'

type NavItem = {
  to: string
  end?: boolean
  label: string
  shortLabel: string
  icon: (props: { active: boolean }) => ReactNode
}

function navClass(active: boolean, compact = false): string {
  const base = compact
    ? 'flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-all duration-200 ease-out'
    : 'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-medium transition-all duration-200 ease-out'
  if (active) {
    return `${base} bg-indigo-500/20 text-indigo-100 ring-1 ring-indigo-400/30`
  }
  return `${base} text-zinc-400 hover:bg-white/5 hover:text-zinc-100`
}

const NAV_ITEMS: NavItem[] = [
  {
    to: '/',
    end: true,
    label: 'My List',
    shortLabel: 'List',
    icon: ({ active }) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 ${active ? 'stroke-indigo-200' : 'stroke-current'}`} fill="none" strokeWidth="1.8">
        <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/search',
    label: 'Search',
    shortLabel: 'Search',
    icon: ({ active }) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 ${active ? 'stroke-indigo-200' : 'stroke-current'}`} fill="none" strokeWidth="1.8">
        <circle cx="11" cy="11" r="7" />
        <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    to: '/settings',
    label: 'Settings',
    shortLabel: 'Settings',
    icon: ({ active }) => (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={`h-5 w-5 ${active ? 'stroke-indigo-200' : 'stroke-current'}`} fill="none" strokeWidth="1.8">
        <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" />
        <path
          d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2.1 2.1 0 0 1-1.5 3.6 2.1 2.1 0 0 1-1.5-.6l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V22a2.1 2.1 0 0 1-4.2 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2.1 2.1 0 0 1-3-3l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H2.1a2.1 2.1 0 0 1 0-4.2h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2.1 2.1 0 0 1 3-3l.1.1a1.7 1.7 0 0 0 1.9.3h.1a1.7 1.7 0 0 0 1-1.5V2.1a2.1 2.1 0 0 1 4.2 0v.2a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2.1 2.1 0 0 1 3 3l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H22a2.1 2.1 0 0 1 0 4.2h-.2a1.7 1.7 0 0 0-1.5 1z"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
]

export function AppShell() {
  const { user, logout } = useAuth()
  const [profileOpen, setProfileOpen] = useState(false)

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(99,102,241,0.12),_transparent_55%)]" />
      <header className="sticky top-0 z-40 border-b border-white/5 bg-zinc-950/75 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4 sm:gap-4">
          <NavLink
            to="/"
            end
            className="flex shrink-0 items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/15 ring-1 ring-indigo-400/20">
              <img src="/favicon.svg" alt="" className="h-5 w-5" />
            </span>
            <span className="hidden font-semibold tracking-tight sm:inline">Anime Tracker</span>
          </NavLink>

          <nav
            className="mx-auto hidden md:flex items-center rounded-full border border-white/10 bg-zinc-900/50 p-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]"
            aria-label="Main"
          >
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => navClass(isActive)}>
                {({ isActive }) => (
                  <>
                    {item.icon({ active: isActive })}
                    {item.label}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {user ? (
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={profileOpen}
                className="flex max-w-[11rem] items-center gap-2 rounded-full border border-white/10 bg-zinc-900/60 px-2.5 py-1.5 text-left transition-colors hover:border-white/20 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50"
                title={user.email}
              >
                <ProfileAvatar username={user.username} size="sm" />
                <span className="truncate text-sm text-zinc-300">{user.username}</span>
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                void logout()
              }}
              className="rounded-full border border-white/10 bg-zinc-900/60 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:border-white/20 hover:bg-zinc-800 hover:text-zinc-50"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {user ? (
        <ProfileModal open={profileOpen} user={user} onClose={() => setProfileOpen(false)} />
      ) : null}

      <main className="relative mx-auto w-full max-w-5xl px-4 py-8 pb-24 md:pb-10">
        <PageTransition />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-zinc-950/85 backdrop-blur-xl pb-[max(0.5rem,env(safe-area-inset-bottom))] md:hidden"
        aria-label="Main"
      >
        <div className="mx-auto flex max-w-lg items-stretch gap-1 px-2 pt-2">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => navClass(isActive, true)}>
              {({ isActive }) => (
                <>
                  {item.icon({ active: isActive })}
                  {item.shortLabel}
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
