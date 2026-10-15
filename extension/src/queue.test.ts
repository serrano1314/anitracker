import { describe, expect, it } from 'vitest'
import type { ProgressEvent } from './messages'
import { QUEUE_LIMIT, claimEpisode, enqueueProgress, removeProgress } from './queue'

function event(episode: number): ProgressEvent {
  return {
    rawTitle: 'One Piece Episode 1',
    episode,
    siteHost: 'example.com',
    pageUrl: 'https://example.com/watch',
    isMovie: false,
  }
}

describe('progress queue', () => {
  it('keeps one pending event per episode', () => {
    const once = enqueueProgress([], event(812))
    const twice = enqueueProgress(once, event(812))
    expect(twice).toHaveLength(1)
    expect(enqueueProgress(twice, event(813))).toHaveLength(2)
  })

  it('drops the oldest events past the cap', () => {
    let queue: ProgressEvent[] = []
    for (let episode = 1; episode <= QUEUE_LIMIT + 2; episode += 1) {
      queue = enqueueProgress(queue, event(episode))
    }
    expect(queue).toHaveLength(QUEUE_LIMIT)
    expect(queue[0]?.episode).toBe(3)
  })

  it('saves a new page or episode once', () => {
    const sent = new Set<string>()
    const first = event(812)
    expect(claimEpisode(sent, first)).toEqual(first)
    expect(claimEpisode(sent, first)).toBeNull()
    expect(claimEpisode(sent, event(813))).toMatchObject({ episode: 813 })
    expect(claimEpisode(sent, null)).toBeNull()
  })

  it('removes a saved event', () => {
    const queue = enqueueProgress(enqueueProgress([], event(1)), event(2))
    expect(removeProgress(queue, event(1)).map((item) => item.episode)).toEqual([2])
  })
})
