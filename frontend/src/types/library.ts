export const LIBRARY_STATUSES = [
  'watching',
  'completed',
  'plan_to_watch',
  'on_hold',
  'dropped',
] as const

export type LibraryStatus = (typeof LIBRARY_STATUSES)[number]

export const STATUS_LABELS: Record<LibraryStatus, string> = {
  watching: 'Watching',
  completed: 'Completed',
  plan_to_watch: 'Plan to watch',
  on_hold: 'On hold',
  dropped: 'Dropped',
}

export function isLibraryStatus(value: string): value is LibraryStatus {
  return (LIBRARY_STATUSES as readonly string[]).includes(value)
}

export type LibraryEntry = {
  anilist_id: number
  status: LibraryStatus
  score: number | null
  last_episode_watched: number
  watched_count: number
  total_episodes: number | null
  title_romaji: string
  title_english: string | null
  cover_url: string | null
  format: string | null
}

export type LibraryListResponse = {
  page: number
  has_next_page: boolean
  results: LibraryEntry[]
}

export type WatchedEpisodes = {
  anilist_id: number
  episodes: number[]
}

export type ProgressState = {
  anilist_id: number
  watched_count: number
  last_episode_watched: number
  status: LibraryStatus
  total_episodes: number | null
}
