import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthProvider'

export function LoginPage() {
  const { isReady, isAuthenticated, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isReady && isAuthenticated) {
    return <Navigate to="/" replace />
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log in')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 text-zinc-50">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
      >
        <h1 className="text-2xl font-semibold">Log in</h1>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        <label className="block space-y-1 text-sm">
          <span className="text-zinc-300">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2"
          />
        </label>
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-indigo-500 px-3 py-2 font-medium hover:bg-indigo-400 disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="text-center text-sm text-zinc-400">
          No account?{' '}
          <Link to="/register" className="text-indigo-400 hover:underline">
            Register
          </Link>
        </p>
      </form>
    </main>
  )
}
