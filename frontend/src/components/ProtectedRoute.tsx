import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'

export function ProtectedRoute() {
  const { isReady, isAuthenticated } = useAuth()

  if (!isReady) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-300">
        Loading…
      </main>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <Outlet />
}
