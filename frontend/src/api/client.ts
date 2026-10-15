export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let accessToken: string | null = null

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

export function buildAuthHeaders(
  token: string | null,
  extra?: HeadersInit,
): Headers {
  const headers = new Headers(extra)
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  return headers
}

export async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await readApiError(response)
  }
  return (await response.json()) as T
}

export async function readApiError(response: Response): Promise<ApiError> {
  const data: unknown = await response.json().catch(() => null)
  let message = response.statusText || 'Request failed'
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = (data as { detail: unknown }).detail
    if (typeof detail === 'string') {
      message = detail
    } else if (Array.isArray(detail)) {
      message = 'Invalid request'
    }
  }
  return new ApiError(message, response.status)
}

function apiOrigin(): string {
  const configured = import.meta.env.VITE_API_BASE
  if (typeof configured !== 'string') {
    return ''
  }
  return configured.trim().replace(/\/+$/, '')
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const headers = buildAuthHeaders(accessToken, options.headers)
  return fetch(`${apiOrigin()}${path}`, { ...options, headers, credentials: 'include' })
}
