import { describe, expect, it } from 'vitest'
import { ApiError, buildAuthHeaders, readApiError, readJson } from './client'

describe('buildAuthHeaders', () => {
  it('sets JSON content type and omits Authorization when logged out', () => {
    const headers = buildAuthHeaders(null)
    expect(headers.get('Content-Type')).toBe('application/json')
    expect(headers.get('Authorization')).toBeNull()
  })

  it('adds a Bearer token when logged in', () => {
    const headers = buildAuthHeaders('abc123')
    expect(headers.get('Authorization')).toBe('Bearer abc123')
  })
})

describe('readApiError', () => {
  it('reads a FastAPI string detail', async () => {
    const response = new Response(JSON.stringify({ detail: 'Invalid email or password' }), {
      status: 401,
      statusText: 'Unauthorized',
    })
    const error = await readApiError(response)
    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(401)
    expect(error.message).toBe('Invalid email or password')
  })
})

describe('readJson', () => {
  it('returns the JSON body when the response is ok', async () => {
    const response = new Response(JSON.stringify({ ok: true }), { status: 200 })
    await expect(readJson<{ ok: boolean }>(response)).resolves.toEqual({ ok: true })
  })

  it('throws ApiError when the response failed', async () => {
    const response = new Response(JSON.stringify({ detail: 'Nope' }), { status: 404 })
    await expect(readJson(response)).rejects.toMatchObject({
      status: 404,
      message: 'Nope',
    })
  })
})
