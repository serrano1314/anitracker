import { useAuth } from '../auth/AuthProvider'

export function HomePage() {
  const { user, logout } = useAuth()

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-50">
      <div className="w-full max-w-md space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-center">
        <h1 className="text-3xl font-semibold">Anime Tracker</h1>
        <p className="text-zinc-300">
          Signed in as <span className="font-medium text-zinc-50">{user?.username}</span>
        </p>
        <p className="text-sm text-zinc-400">{user?.email}</p>
        <button
          type="button"
          onClick={() => {
            void logout()
          }}
          className="w-full rounded-md border border-zinc-700 px-3 py-2 hover:bg-zinc-800"
        >
          Log out
        </button>
      </div>
    </main>
  )
}
