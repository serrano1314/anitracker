import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import {
  EPISODE_GRID_GAP,
  EPISODE_ROW_HEIGHT,
  RANGE_SIZE,
  columnCount,
  episodeRanges,
  rangeStartFor,
  rowCount,
  scrollOffsetFor,
  visibleRowRange,
} from '../lib/episodes'

type EpisodeGridProps = {
  totalEpisodes: number | null
  watchedEpisodes: number[]
  focusEpisode: number | null
  onSelect: (episode: number) => void
}

export function EpisodeGrid({
  totalEpisodes,
  watchedEpisodes,
  focusEpisode,
  onSelect,
}: EpisodeGridProps) {
  const highestWatched = watchedEpisodes.reduce((max, episode) => Math.max(max, episode), 0)
  const [openedThrough, setOpenedThrough] = useState(RANGE_SIZE)
  const [selectedStart, setSelectedStart] = useState<number | null>(null)
  const [seenFocus, setSeenFocus] = useState(focusEpisode)
  if (focusEpisode !== seenFocus) {
    setSeenFocus(focusEpisode)
    setSelectedStart(focusEpisode == null ? null : rangeStartFor(focusEpisode))
  }
  const highestRelevant = Math.max(highestWatched, focusEpisode ?? 0, openedThrough)
  const ranges = useMemo(
    () => episodeRanges(totalEpisodes, highestRelevant),
    [highestRelevant, totalEpisodes],
  )
  const totalKnown = totalEpisodes != null && totalEpisodes > 0

  const active =
    ranges.find((range) => range.start === selectedStart) ??
    ranges.find((range) => focusEpisode != null && focusEpisode >= range.start && focusEpisode <= range.end) ??
    ranges[0]

  const watched = useMemo(() => new Set(watchedEpisodes), [watchedEpisodes])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [columns, setColumns] = useState(6)
  const [scrollTop, setScrollTop] = useState(0)
  const [viewportHeight, setViewportHeight] = useState(320)
  const desiredScroll = active
    ? scrollOffsetFor(focusEpisode, active.start, active.end, columns)
    : 0
  const scrollKey = `${active?.start ?? 0}:${focusEpisode ?? ''}:${columns}`
  const [appliedScrollKey, setAppliedScrollKey] = useState(scrollKey)
  if (scrollKey !== appliedScrollKey) {
    setAppliedScrollKey(scrollKey)
    setScrollTop(desiredScroll)
  }

  useEffect(() => {
    const node = scrollRef.current
    if (!node) {
      return
    }
    const update = () => {
      const nextColumns = columnCount(node.clientWidth)
      const nextHeight = node.clientHeight
      setColumns((current) => (current === nextColumns ? current : nextColumns))
      setViewportHeight((current) => (current === nextHeight ? current : nextHeight))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const node = scrollRef.current
    if (node && node.scrollTop !== desiredScroll) {
      node.scrollTop = desiredScroll
    }
  }, [appliedScrollKey, desiredScroll])

  if (!active) {
    return null
  }

  const episodes = Array.from(
    { length: active.end - active.start + 1 },
    (_, index) => active.start + index,
  )
  const rows = rowCount(episodes.length, columns)
  const visible = visibleRowRange(scrollTop, viewportHeight, EPISODE_ROW_HEIGHT, rows)
  const buttonHeight = EPISODE_ROW_HEIGHT - EPISODE_GRID_GAP

  return (
    <div className="space-y-3">
      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Episode ranges">
        {ranges.map((range) => {
          const selected = range.start === active.start
          return (
            <button
              key={range.start}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setSelectedStart(range.start)}
              className={
                selected
                  ? 'shrink-0 rounded-full bg-indigo-500 px-3 py-1 text-sm font-medium'
                  : 'shrink-0 rounded-full border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-800'
              }
            >
              {range.start}–{range.end}
            </button>
          )
        })}
        {totalKnown ? null : (
          <button
            type="button"
            onClick={() => setOpenedThrough((current) => Math.max(current, active.end) + RANGE_SIZE)}
            className="shrink-0 rounded-full border border-dashed border-zinc-600 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-800"
          >
            Next 100
          </button>
        )}
      </div>
      <div
        ref={scrollRef}
        className="h-80 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        <div className="relative" style={{ height: rows * EPISODE_ROW_HEIGHT }}>
          {Array.from({ length: visible.end - visible.start }, (_, offset) => {
            const rowIndex = visible.start + offset
            const rowStart = rowIndex * columns
            const rowEpisodes = episodes.slice(rowStart, rowStart + columns)
            return (
              <div
                key={rowIndex}
                className="absolute inset-x-2 grid"
                style={{
                  top: rowIndex * EPISODE_ROW_HEIGHT,
                  height: buttonHeight,
                  gap: EPISODE_GRID_GAP,
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                }}
              >
                {rowEpisodes.map((episode) => {
                  const isWatched = watched.has(episode)
                  const focused = episode === focusEpisode
                  return (
                    <button
                      key={episode}
                      type="button"
                      aria-pressed={isWatched}
                      aria-current={focused ? 'true' : undefined}
                      onClick={() => onSelect(episode)}
                      className={
                        isWatched
                          ? 'rounded-md bg-indigo-500 text-sm font-medium tabular-nums hover:bg-indigo-400'
                          : 'rounded-md border border-zinc-700 text-sm tabular-nums text-zinc-200 hover:bg-zinc-800'
                      }
                      style={focused ? { outline: '2px solid #fcd34d', outlineOffset: '1px' } : undefined}
                    >
                      {episode}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Filled numbers are watched. Click a number to open watch links.
      </p>
    </div>
  )
}
