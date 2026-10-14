const AIRING_LABELS: Record<string, string> = {
  FINISHED: 'Finished',
  RELEASING: 'Airing',
  NOT_YET_RELEASED: 'Not yet aired',
  CANCELLED: 'Cancelled',
  HIATUS: 'Hiatus',
}

export function displayTitle(anime: {
  title_english: string | null
  title_romaji: string
}): string {
  const english = anime.title_english?.trim()
  return english ? english : anime.title_romaji
}

export function formatLabel(format: string | null): string | null {
  if (!format) {
    return null
  }
  if (format === 'TV' || format === 'OVA' || format === 'ONA') {
    return format
  }
  return format.charAt(0) + format.slice(1).toLowerCase()
}

export function airingLabel(status: string | null): string | null {
  if (!status) {
    return null
  }
  return AIRING_LABELS[status] ?? status
}

export function metaLine(
  format: string | null,
  seasonYear: number | null,
  airingStatus: string | null,
): string {
  return [formatLabel(format), seasonYear, airingLabel(airingStatus)].filter(Boolean).join(' · ')
}
