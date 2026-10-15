import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ApiError } from '../api/client'
import { useAuth } from '../auth/AuthProvider'
import { AuthField } from '../components/AuthField'
import { AuthFormShell } from '../components/AuthFormShell'
import { ForgotPasswordUnavailableTrigger } from '../components/ForgotPasswordUnavailable'
import { UI, cn } from '../lib/ui'

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
    <AuthFormShell
      title="Welcome back"
      description="Sign in to sync your list and watch progress."
      footer={
        <>
          No account?{' '}
          <Link to="/register" className="font-medium text-indigo-300 hover:text-indigo-200 hover:underline">
            Register
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="space-y-2">
          <AuthField
            label="Password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="text-right text-sm">
            <ForgotPasswordUnavailableTrigger />
          </p>
        </div>
        {error ? (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={submitting} className={cn(UI.btn, UI.btnPrimary, 'w-full py-3')}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthFormShell>
  )
}
