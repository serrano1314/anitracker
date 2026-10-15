import type { ProgressEvent } from './messages'

export const QUEUE_LIMIT = 50

export function progressKey(event: ProgressEvent): string {
  return `${event.siteHost}|${event.rawTitle}|${event.episode}|${event.isMovie}`
}

export function claimEpisode(sent: Set<string>, event: ProgressEvent | null): ProgressEvent | null {
  if (!event) {
    return null
  }
  const key = progressKey(event)
  if (sent.has(key)) {
    return null
  }
  sent.add(key)
  return event
}

export function enqueueProgress(queue: ProgressEvent[], event: ProgressEvent): ProgressEvent[] {
  if (queue.some((item) => progressKey(item) === progressKey(event))) {
    return queue
  }
  const next = [...queue, event]
  return next.length > QUEUE_LIMIT ? next.slice(next.length - QUEUE_LIMIT) : next
}

export function removeProgress(queue: ProgressEvent[], event: ProgressEvent): ProgressEvent[] {
  const key = progressKey(event)
  return queue.filter((item) => progressKey(item) !== key)
}
