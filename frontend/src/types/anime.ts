export type ExternalLink = {
  site: string
  url: string
}

export type Anime = {
  anilist_id: number
  mal_id: number | null
  title_romaji: string
  title_english: string | null
  title_synonyms: string[]
  cover_url: string | null
  format: string | null
  total_episodes: number | null
  airing_status: string | null
  season_year: number | null
  external_links: ExternalLink[]
}

export type AnimeDetail = Anime & {
  last_synced_at: string
}

export type AnimeSearchResponse = {
  page: number
  has_next_page: boolean
  results: Anime[]
}
