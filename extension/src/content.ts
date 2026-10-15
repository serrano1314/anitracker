import type { ProgressEvent } from './messages'
import { readTitleAndEpisode, siteHost } from './parsers/generic'
import { claimEpisode } from './queue'

declare global {
  interface Window {
    __animeTrackerInjected?: boolean
  }
}

const WATCH_THRESHOLD = 0.85
const sent = new Set<string>()
const watchedVideos = new WeakSet<HTMLVideoElement>()

if (!window.__animeTrackerInjected) {
  window.__animeTrackerInjected = true
  watchHistory()
  watchTitle()
  watchVideos()
  scheduleSave()
  window.setInterval(saveCurrent, 1500)
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (isRecord(message) && message.type === 'read-page') {
      sendResponse({ event: currentEvent() })
      return true
    }
    if (isRecord(message) && message.type === 'show-toast' && typeof message.text === 'string') {
      showToast(message.text)
    }
    return undefined
  })
}

function currentEvent(): ProgressEvent | null {
  const heading = document.querySelector('h1')?.textContent?.trim() ?? ''
  const parsed = readTitleAndEpisode({
    title: document.title,
    heading,
    pageUrl: location.href,
  })
  if (!parsed.rawTitle || parsed.episode === null) {
    return null
  }
  return {
    rawTitle: parsed.rawTitle.slice(0, 500),
    episode: parsed.episode,
    siteHost: siteHost(location.href),
    pageUrl: location.href.slice(0, 2000),
    isMovie: parsed.isMovie,
  }
}

function watchVideos(): void {
  for (const video of document.querySelectorAll('video')) {
    if (watchedVideos.has(video)) {
      continue
    }
    watchedVideos.add(video)
    const report = () => {
      considerProgress(video)
    }
    video.addEventListener('timeupdate', report)
    video.addEventListener('ended', report)
  }
}

function considerProgress(video: HTMLVideoElement): void {
  const duration = video.duration
  const ended = video.ended
  const farEnough = Number.isFinite(duration) && duration > 0 && video.currentTime / duration >= WATCH_THRESHOLD
  if (!ended && !farEnough) {
    return
  }
  saveCurrent()
}

let saveTimer: number | undefined

function scheduleSave(): void {
  window.clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    saveCurrent()
  }, 400)
}

function saveCurrent(): void {
  const event = claimEpisode(sent, currentEvent())
  if (!event) {
    return
  }
  void chrome.runtime.sendMessage({ type: 'save-progress', event })
}

function watchTitle(): void {
  const title = document.querySelector('title')
  if (!title) {
    return
  }
  const observer = new MutationObserver(() => {
    watchVideos()
    scheduleSave()
  })
  observer.observe(title, { childList: true, subtree: true, characterData: true })
}

function watchHistory(): void {
  const script = document.createElement('script')
  script.textContent = `(() => {
    const notify = () => window.postMessage({ source: 'anime-tracker', type: 'navigation' }, '*');
    const push = history.pushState;
    history.pushState = function(...args) {
      const result = push.apply(this, args);
      notify();
      return result;
    };
    const replace = history.replaceState;
    history.replaceState = function(...args) {
      const result = replace.apply(this, args);
      notify();
      return result;
    };
  })();`
  document.documentElement.appendChild(script)
  script.remove()
  window.addEventListener('message', (event) => {
    if (event.source !== window) {
      return
    }
    const data: unknown = event.data
    if (isRecord(data) && data.source === 'anime-tracker' && data.type === 'navigation') {
      watchVideos()
      scheduleSave()
    }
  })
  window.addEventListener('popstate', () => {
    watchVideos()
    scheduleSave()
  })
}

function showToast(text: string): void {
  const existing = document.getElementById('anime-tracker-toast')
  existing?.remove()
  const toast = document.createElement('div')
  toast.id = 'anime-tracker-toast'
  toast.textContent = text
  toast.style.position = 'fixed'
  toast.style.right = '16px'
  toast.style.bottom = '16px'
  toast.style.zIndex = '2147483647'
  toast.style.maxWidth = '320px'
  toast.style.padding = '12px 14px'
  toast.style.borderRadius = '10px'
  toast.style.background = '#18181b'
  toast.style.color = '#fafafa'
  toast.style.font = '14px system-ui, sans-serif'
  toast.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.35)'
  document.documentElement.appendChild(toast)
  window.setTimeout(() => {
    toast.remove()
  }, 4000)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object'
}
