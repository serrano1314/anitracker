import type { LoginRequest, RegisterRequest, TokenResponse, User } from '../types/auth'
import { apiFetch, readApiError } from './client'

async function parseToken(response: Response): Promise<TokenResponse> {
  if (!response.ok) {
    throw await readApiError(response)
  }
  return (await response.json()) as TokenResponse
}

export async function register(body: RegisterRequest): Promise<TokenResponse> {
  return parseToken(
    await apiFetch('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}

export async function login(body: LoginRequest): Promise<TokenResponse> {
  return parseToken(
    await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  )
}

export async function refresh(): Promise<TokenResponse> {
  return parseToken(await apiFetch('/api/v1/auth/refresh', { method: 'POST' }))
}

export async function logout(): Promise<void> {
  const response = await apiFetch('/api/v1/auth/logout', { method: 'POST' })
  if (!response.ok) {
    throw await readApiError(response)
  }
}

export async function fetchMe(): Promise<User> {
  const response = await apiFetch('/api/v1/auth/me', { method: 'GET' })
  if (!response.ok) {
    throw await readApiError(response)
  }
  return (await response.json()) as User
}
