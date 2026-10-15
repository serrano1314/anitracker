import { describe, expect, it } from 'vitest'
import { looksLikeMovie, parseEpisode, readTitleAndEpisode, siteHost } from './generic'

describe('parseEpisode', () => {
  it('tries the episode patterns in order', () => {
    expect(parseEpisode('One Piece Episode 812 English Sub')).toBe(812)
    expect(parseEpisode('Title ep. 7')).toBe(7)
    expect(parseEpisode('Title ep7 now')).toBe(7)
    expect(parseEpisode('One Piece e12')).toBe(12)
    expect(parseEpisode('Show Name - 4')).toBe(4)
  })

  it('prefers the earlier pattern when several could match', () => {
    expect(parseEpisode('Episode 3 and also e9')).toBe(3)
    expect(parseEpisode('No number here')).toBeNull()
    expect(parseEpisode('episode 0')).toBeNull()
  })
})

describe('readTitleAndEpisode', () => {
  it('keeps the page title and marks a movie as episode 1', () => {
    const parsed = readTitleAndEpisode({
      title: 'A Movie (Film)',
      heading: 'A Movie',
      pageUrl: 'https://example.com/movies/a-movie',
    })
    expect(parsed.rawTitle).toBe('A Movie (Film)')
    expect(parsed.episode).toBe(1)
    expect(parsed.isMovie).toBe(true)
    expect(looksLikeMovie('not a show')).toBe(false)
  })

  it('reads the host without www', () => {
    expect(siteHost('https://www.Example.com/watch/one-piece')).toBe('example.com')
  })
})
