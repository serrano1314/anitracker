import type { ProgressEvent, UnmatchedPrompt } from './messages'
import { isProgressEvent } from './messages'

export const DEFAULT_API_BASE = 'http://127.0.0.1:8000'

export type ExtensionState = {
  token: string
  apiBase: string
  trackedOrigins: string[]
  queue: ProgressEvent[]
  unmatched: UnmatchedPrompt | null
}

export function normalizeApiBase(value: string): string {
  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed || DEFAULT_API_BASE
}

export function pageOrigin(pageUrl: string): string | null {
  try {
    const url = new URL(pageUrl)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return null
    }
    return url.origin
  } catch {
    return null
  }
}

export async function loadState(): Promise<ExtensionState> {
  const stored = await chrome.storage.local.get({
    token: '',
    apiBase: DEFAULT_API_BASE,
    trackedOrigins: [] as string[],
    queue: [] as ProgressEvent[],
    unmatched: null as UnmatchedPrompt | null,
  })
  return {
    token: typeof stored.token === 'string' ? stored.token : '',
    apiBase: normalizeApiBase(typeof stored.apiBase === 'string' ? stored.apiBase : DEFAULT_API_BASE),
    trackedOrigins: stringList(stored.trackedOrigins),
    queue: Array.isArray(stored.queue) ? stored.queue.filter(isProgressEvent) : [],
    unmatched: isUnmatched(stored.unmatched) ? stored.unmatched : null,
  }
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value.filter((item): item is string => typeof item === 'string')
}

function isUnmatched(value: unknown): value is UnmatchedPrompt {
  if (!value || typeof value !== 'object') {
    return false
  }
  const prompt = value as UnmatchedPrompt
  return isProgressEvent(prompt.event) && Array.isArray(prompt.candidates)
}
