import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'text-indigo-300' : 'text-zinc-300 hover:text-zinc-50'

export function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/95">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <NavLink to="/" className="font-semibold">
            Anime Tracker
          </NavLink>
          <nav className="flex gap-3 text-sm">
            <NavLink to="/" end className={linkClass}>
              My List
            </NavLink>
            <NavLink to="/search" className={linkClass}>
              Search
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-zinc-400">{user?.username}</span>
            <button
              type="button"
              onClick={() => {
                void logout()
              }}
              className="rounded-md border border-zinc-700 px-3 py-1.5 hover:bg-zinc-800"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}
