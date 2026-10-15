export const RANGE_SIZE = 100
export const MAX_EPISODE_NUMBER = 5000
export const EPISODE_ROW_HEIGHT = 48
export const EPISODE_GRID_GAP = 8

export type EpisodeRange = {
  start: number
  end: number
}

export function knownTotal(totalEpisodes: number | null | undefined): number | null {
  if (totalEpisodes == null || totalEpisodes < 1) {
    return null
  }
  return totalEpisodes
}

export function episodeCountLabel(totalEpisodes: number | null): string {
  const total = knownTotal(totalEpisodes)
  if (total == null) {
    return 'Episode count unknown'
  }
  return total === 1 ? '1 episode' : `${total} episodes`
}

export function progressLabel(watchedCount: number, totalEpisodes: number | null): string {
  const total = knownTotal(totalEpisodes)
  return `${watchedCount} / ${total == null ? '?' : total}`
}

export function progressRatio(watchedCount: number, totalEpisodes: number | null): number | null {
  const total = knownTotal(totalEpisodes)
  if (total == null) {
    return null
  }
  return Math.min(1, Math.max(0, watchedCount / total))
}

export function nextEpisodeToMark(
  lastEpisodeWatched: number,
  totalEpisodes: number | null,
): number | null {
  const next = lastEpisodeWatched + 1
  if (next < 1 || next > MAX_EPISODE_NUMBER) {
    return null
  }
  const total = knownTotal(totalEpisodes)
  if (total != null && next > total) {
    return null
  }
  return next
}

export function parseEpisodeInput(value: string, totalEpisodes: number | null): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) {
    return null
  }
  const episode = Number(trimmed)
  const max = knownTotal(totalEpisodes) ?? MAX_EPISODE_NUMBER
  if (episode < 1 || episode > max) {
    return null
  }
  return episode
}

export function episodeRanges(
  totalEpisodes: number | null,
  highestRelevant: number,
): EpisodeRange[] {
  const total = knownTotal(totalEpisodes)
  const covered = total ?? Math.max(1, highestRelevant, RANGE_SIZE)
  const rangeCount = Math.ceil(covered / RANGE_SIZE)
  return Array.from({ length: rangeCount }, (_, index) => {
    const start = index * RANGE_SIZE + 1
    const rawEnd = start + RANGE_SIZE - 1
    return { start, end: total == null ? rawEnd : Math.min(rawEnd, total) }
  })
}

export function rangeStartFor(episode: number): number {
  const safe = Math.max(1, Math.floor(episode))
  return Math.floor((safe - 1) / RANGE_SIZE) * RANGE_SIZE + 1
}

/** Jump/focus target, or the highest watched episode when opening the grid. */
export function episodeAnchor(
  focusEpisode: number | null,
  watchedEpisodes: readonly number[],
): number | null {
  if (focusEpisode != null) {
    return focusEpisode
  }
  const highest = watchedEpisodes.reduce((max, episode) => Math.max(max, episode), 0)
  return highest > 0 ? highest : null
}

export function activeRangeForEpisode(
  ranges: EpisodeRange[],
  selectedStart: number | null,
  anchorEpisode: number | null,
): EpisodeRange | undefined {
  if (ranges.length === 0) {
    return undefined
  }
  if (selectedStart != null) {
    const selected = ranges.find((range) => range.start === selectedStart)
    if (selected) {
      return selected
    }
  }
  if (anchorEpisode != null) {
    const match = ranges.find(
      (range) => anchorEpisode >= range.start && anchorEpisode <= range.end,
    )
    if (match) {
      return match
    }
  }
  return ranges[0]
}

export function columnCount(
  width: number,
  minCell = 52,
  gap = EPISODE_GRID_GAP,
  minColumns = 4,
  maxColumns = 12,
): number {
  if (width <= 0) {
    return minColumns
  }
  const count = Math.floor((width + gap) / (minCell + gap))
  return Math.min(maxColumns, Math.max(minColumns, count))
}

export function rowCount(itemCount: number, columns: number): number {
  if (itemCount <= 0 || columns <= 0) {
    return 0
  }
  return Math.ceil(itemCount / columns)
}

export function scrollOffsetFor(
  focusEpisode: number | null,
  rangeStart: number,
  rangeEnd: number,
  columns: number,
  rowHeight = EPISODE_ROW_HEIGHT,
): number {
  if (focusEpisode == null || columns < 1 || rowHeight < 1) {
    return 0
  }
  if (focusEpisode < rangeStart || focusEpisode > rangeEnd) {
    return 0
  }
  const row = Math.floor((focusEpisode - rangeStart) / columns)
  return Math.max(0, row * rowHeight - rowHeight)
}

export function visibleRowRange(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  totalRows: number,
  overscan = 2,
): { start: number; end: number } {
  if (totalRows <= 0 || rowHeight <= 0 || viewportHeight <= 0) {
    return { start: 0, end: 0 }
  }
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan)
  const end = Math.min(totalRows, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan)
  return { start, end }
}
