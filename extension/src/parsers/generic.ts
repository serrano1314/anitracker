const EPISODE_PATTERNS: RegExp[] = [
  /episode\s*(\d+)/i,
  /\bep\.?\s*(\d+)/i,
  /\be(\d+)\b/i,
  /-\s*(\d+)\s*$/,
]

export function parseEpisode(text: string): number | null {
  for (const pattern of EPISODE_PATTERNS) {
    const match = pattern.exec(text)
    if (!match?.[1]) {
      continue
    }
    const episode = Number.parseInt(match[1], 10)
    if (episode >= 1) {
      return episode
    }
  }
  return null
}

export function looksLikeMovie(text: string): boolean {
  return /\b(?:movie|film)\b/i.test(text)
}

export function siteHost(pageUrl: string): string {
  const hostname = new URL(pageUrl).hostname.replace(/^www\./i, '')
  return hostname
}

export type ParsedPage = {
  rawTitle: string
  episode: number | null
  isMovie: boolean
}

export function readTitleAndEpisode(input: {
  title: string
  heading: string
  pageUrl: string
}): ParsedPage {
  const rawTitle = input.title.trim() || input.heading.trim()
  const episode = parseEpisode([input.heading, input.title, input.pageUrl].filter(Boolean).join('\n'))
  const isMovie = episode === null && looksLikeMovie(`${input.title}\n${input.heading}\n${input.pageUrl}`)
  return {
    rawTitle,
    episode: episode ?? (isMovie ? 1 : null),
    isMovie,
  }
}
