import type { AnimeDetail, AnimeSearchResponse } from '../types/anime'
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
