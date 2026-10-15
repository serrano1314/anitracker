export type ProgressEvent = {
  rawTitle: string
  episode: number
  siteHost: string
  pageUrl: string
  isMovie: boolean
}

export type AnimeCandidate = {
  anilist_id: number
  title_romaji: string
  title_english: string | null
  cover_url: string | null
  format: string | null
  total_episodes: number | null
}

export type ProgressResult =
  | { matched: true; anime: AnimeCandidate; episode: number }
  | { matched: false; candidates: AnimeCandidate[] }

export type UnmatchedPrompt = {
  event: ProgressEvent
  candidates: AnimeCandidate[]
}

export type SaveResponse =
  | { ok: true; matched: true; label: string }
  | { ok: true; matched: false; candidates: AnimeCandidate[] }
  | { ok: false; queued: true }
  | { ok: false; queued: false; error: string }

export type SaveMessage = {
  type: 'save-progress'
  event: ProgressEvent
}

export type ConfirmMessage = {
  type: 'confirm-match'
  anilistId: number
}

export function isProgressEvent(value: unknown): value is ProgressEvent {
  if (!value || typeof value !== 'object') {
    return false
  }
  const event = value as ProgressEvent
  return (
    typeof event.rawTitle === 'string' &&
    typeof event.episode === 'number' &&
    typeof event.siteHost === 'string' &&
    typeof event.pageUrl === 'string' &&
    typeof event.isMovie === 'boolean'
  )
}
