import { describe, expect, it } from 'vitest'
import {
  columnCount,
  episodeCountLabel,
  episodeRanges,
  nextEpisodeToMark,
  parseEpisodeInput,
  progressLabel,
  progressRatio,
  rangeStartFor,
  scrollOffsetFor,
  visibleRowRange,
} from './episodes'

describe('progress labels', () => {
  it('shows watched count over a known total', () => {
    expect(progressLabel(811, 1155)).toBe('811 / 1155')
    expect(progressRatio(811, 1155)).toBeCloseTo(811 / 1155)
  })

  it('labels a known episode count', () => {
    expect(episodeCountLabel(1)).toBe('1 episode')
    expect(episodeCountLabel(1155)).toBe('1155 episodes')
    expect(episodeCountLabel(null)).toBe('Episode count unknown')
  })

  it('shows a question mark when the total is unknown', () => {
    expect(progressLabel(11, null)).toBe('11 / ?')
    expect(progressLabel(11, 0)).toBe('11 / ?')
    expect(progressRatio(11, null)).toBeNull()
  })

  it('uses the watched count when episodes were skipped', () => {
    expect(progressLabel(11, 24)).toBe('11 / 24')
  })
})

describe('next episode', () => {
  it('marks the episode after the highest one watched', () => {
    expect(nextEpisodeToMark(811, 1155)).toBe(812)
    expect(nextEpisodeToMark(0, null)).toBe(1)
  })

  it('stops at a known total and at the episode cap', () => {
    expect(nextEpisodeToMark(1155, 1155)).toBeNull()
    expect(nextEpisodeToMark(5000, null)).toBeNull()
    expect(nextEpisodeToMark(4999, null)).toBe(5000)
  })
})

describe('episode input', () => {
  it('accepts an episode inside the known total', () => {
    expect(parseEpisodeInput('811', 1155)).toBe(811)
  })

  it('accepts a jump when the total is unknown', () => {
    expect(parseEpisodeInput('811', null)).toBe(811)
  })

  it('rejects empty, zero, and out-of-range values', () => {
    expect(parseEpisodeInput('', 100)).toBeNull()
    expect(parseEpisodeInput('0', null)).toBeNull()
    expect(parseEpisodeInput('1156', 1155)).toBeNull()
    expect(parseEpisodeInput('5001', null)).toBeNull()
    expect(parseEpisodeInput('12abc', 100)).toBeNull()
  })
})

describe('episode ranges', () => {
  it('splits a long show into blocks and stops at the known total', () => {
    const ranges = episodeRanges(1155, 1)
    expect(ranges).toHaveLength(12)
    expect(ranges[0]).toEqual({ start: 1, end: 100 })
    expect(ranges.at(-1)).toEqual({ start: 1101, end: 1155 })
    expect(rangeStartFor(811)).toBe(801)
  })

  it('keeps an open-ended range through the highest relevant episode', () => {
    const ranges = episodeRanges(null, 811)
    expect(ranges).toHaveLength(9)
    expect(ranges[8]).toEqual({ start: 801, end: 900 })
  })

  it('starts unknown shows at 1–100', () => {
    expect(episodeRanges(null, 0)).toEqual([{ start: 1, end: 100 }])
    expect(episodeRanges(0, 1)).toEqual([{ start: 1, end: 100 }])
  })

  it('does not extend past a known total', () => {
    expect(episodeRanges(50, 900)).toEqual([{ start: 1, end: 50 }])
    expect(episodeRanges(1, 1)).toEqual([{ start: 1, end: 1 }])
  })
})

describe('virtual rows', () => {
  it('picks a column count from the available width', () => {
    expect(columnCount(0)).toBe(4)
    expect(columnCount(320)).toBe(5)
    expect(columnCount(2000)).toBe(12)
  })

  it('scrolls a jumped episode into the virtual window', () => {
    expect(scrollOffsetFor(811, 801, 900, 10)).toBe(0)
    expect(scrollOffsetFor(850, 801, 900, 10)).toBe(144)
    expect(scrollOffsetFor(811, 1, 100, 10)).toBe(0)
    expect(scrollOffsetFor(null, 801, 900, 10)).toBe(0)
  })

  it('windows the visible rows with overscan', () => {
    expect(visibleRowRange(0, 100, 48, 20)).toEqual({ start: 0, end: 5 })
    expect(visibleRowRange(200, 100, 48, 20)).toEqual({ start: 2, end: 9 })
    expect(visibleRowRange(0, 100, 48, 0)).toEqual({ start: 0, end: 0 })
  })
})
