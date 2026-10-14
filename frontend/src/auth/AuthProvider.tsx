import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { fetchMe, login as loginRequest, logout as logoutRequest, refresh, register as registerRequest } from '../api/auth'
import { setAccessToken } from '../api/client'
import type { User } from '../types/auth'

type AuthContextValue = {
  user: User | null
  isReady: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState<string | null>(null)
  const [bootstrapDone, setBootstrapDone] = useState(false)

  const applyToken = useCallback((next: string | null) => {
    setAccessToken(next)
    setToken(next)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      try {
        const data = await refresh()
        if (!cancelled) {
          applyToken(data.access_token)
        }
      } catch {
        if (!cancelled) {
          applyToken(null)
        }
      } finally {
        if (!cancelled) {
          setBootstrapDone(true)
        }
      }
    }
    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [applyToken])

  const meQuery = useQuery({
    queryKey: ['me'],
    queryFn: fetchMe,
    enabled: bootstrapDone && token !== null,
    retry: false,
  })

  useEffect(() => {
    if (meQuery.isError) {
      applyToken(null)
    }
  }, [applyToken, meQuery.isError])

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await loginRequest({ email, password })
      applyToken(data.access_token)
      await queryClient.fetchQuery({ queryKey: ['me'], queryFn: fetchMe })
    },
    [applyToken, queryClient],
  )

  const register = useCallback(
    async (email: string, username: string, password: string) => {
      const data = await registerRequest({ email, username, password })
      applyToken(data.access_token)
      await queryClient.fetchQuery({ queryKey: ['me'], queryFn: fetchMe })
    },
    [applyToken, queryClient],
  )

  const logout = useCallback(async () => {
    try {
      await logoutRequest()
    } finally {
      applyToken(null)
      queryClient.removeQueries({ queryKey: ['me'] })
    }
  }, [applyToken, queryClient])

  const meSettled = token === null || meQuery.isSuccess || meQuery.isError
  const isReady = bootstrapDone && meSettled
  const isAuthenticated = token !== null && meQuery.data !== undefined

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isReady,
      isAuthenticated,
      login,
      register,
      logout,
    }),
    [isAuthenticated, isReady, login, logout, meQuery.data, register],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
