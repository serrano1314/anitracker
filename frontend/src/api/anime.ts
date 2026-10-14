import type { AnimeDetail, AnimeSearchResponse, WatchLink } from '../types/anime'
import { apiFetch, readJson } from './client'

export function searchAnime(query: string, page: number): Promise<AnimeSearchResponse> {
  const params = new URLSearchParams({ q: query, page: String(page) })
  return apiFetch(`/api/v1/anime/search?${params.toString()}`).then((response) =>
    readJson<AnimeSearchResponse>(response),
  )
}

export function fetchAnime(anilistId: number): Promise<AnimeDetail> {
  return apiFetch(`/api/v1/anime/${anilistId}`).then((response) => readJson<AnimeDetail>(response))
}

export function fetchWatchLinks(anilistId: number, episode: number): Promise<WatchLink[]> {
  return apiFetch(`/api/v1/anime/${anilistId}/episodes/${episode}/watch-links`).then((response) =>
    readJson<WatchLink[]>(response),
  )
}
