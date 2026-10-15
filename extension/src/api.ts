import type { AnimeCandidate, ProgressEvent, ProgressResult } from './messages'

export class ExtensionApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ExtensionApiError'
    this.status = status
  }
}

export function shouldQueue(status: number): boolean {
  return status === 0 || status === 429 || status >= 500
}

export async function postProgress(
  apiBase: string,
  token: string,
  event: ProgressEvent,
): Promise<ProgressResult> {
  const payload = await request(apiBase, token, '/api/v1/extension/progress', {
    raw_title: event.rawTitle,
    episode: event.episode,
    site_host: event.siteHost,
    page_url: event.pageUrl,
    is_movie: event.isMovie,
  })
  return readProgress(payload)
}

export async function postMatch(
  apiBase: string,
  token: string,
  event: ProgressEvent,
  anilistId: number,
): Promise<void> {
  await request(apiBase, token, '/api/v1/extension/match', {
    site_host: event.siteHost,
    raw_title: event.rawTitle,
    anilist_id: anilistId,
  })
}

async function request(
  apiBase: string,
  token: string,
  path: string,
  body: Record<string, string | number | boolean>,
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${apiBase}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ExtensionApiError('API unreachable', 0)
  }
  if (!response.ok) {
    throw new ExtensionApiError(await errorMessage(response), response.status)
  }
  return response.json() as Promise<unknown>
}

async function errorMessage(response: Response): Promise<string> {
  const data: unknown = await response.json().catch(() => null)
  if (data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string') {
    return data.detail
  }
  return response.statusText || 'Request failed'
}

function readProgress(payload: unknown): ProgressResult {
  if (!payload || typeof payload !== 'object' || !('matched' in payload)) {
    throw new ExtensionApiError('Unexpected progress response', 502)
  }
  if (payload.matched === true && 'anime' in payload && 'episode' in payload && isCandidate(payload.anime)) {
    return {
      matched: true,
      anime: payload.anime,
      episode: typeof payload.episode === 'number' ? payload.episode : 0,
    }
  }
  const candidates = 'candidates' in payload && Array.isArray(payload.candidates)
    ? payload.candidates.filter(isCandidate)
    : []
  return { matched: false, candidates }
}

function isCandidate(value: unknown): value is AnimeCandidate {
  if (!value || typeof value !== 'object') {
    return false
  }
  const anime = value as AnimeCandidate
  return typeof anime.anilist_id === 'number' && typeof anime.title_romaji === 'string'
}
