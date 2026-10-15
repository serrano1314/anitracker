import type { AnimeCandidate, ProgressEvent, SaveResponse, UnmatchedPrompt } from '../messages'
import { loadState, normalizeApiBase, pageOrigin } from '../storage'

const apiBaseInput = document.querySelector<HTMLInputElement>('#api-base')
const tokenInput = document.querySelector<HTMLInputElement>('#token')
const statusNode = document.querySelector<HTMLElement>('#status')
const summaryNode = document.querySelector<HTMLElement>('#page-summary')
const episodeInput = document.querySelector<HTMLInputElement>('#episode')
const matchSection = document.querySelector<HTMLElement>('#match-section')
const candidatesNode = document.querySelector<HTMLElement>('#candidates')

let pageEvent: ProgressEvent | null = null

void init()

document.querySelector('#save-settings')?.addEventListener('click', () => {
  void saveSettings()
})
document.querySelector('#track-site')?.addEventListener('click', () => {
  void trackThisSite()
})
document.querySelector('#mark')?.addEventListener('click', () => {
  void markCurrent()
})
document.querySelector('#plus')?.addEventListener('click', () => {
  void markNext()
})

async function init(): Promise<void> {
  const state = await loadState()
  if (apiBaseInput) {
    apiBaseInput.value = state.apiBase
  }
  if (tokenInput) {
    tokenInput.value = state.token
  }
  renderUnmatched(state.unmatched)
  await readPage()
}

async function saveSettings(): Promise<void> {
  const token = tokenInput?.value.trim() ?? ''
  const apiBase = normalizeApiBase(apiBaseInput?.value ?? '')
  await chrome.storage.local.set({ token, apiBase })
  setStatus(token ? 'Token saved in this browser.' : 'Token cleared.')
}

async function trackThisSite(): Promise<void> {
  const tab = await activeTab()
  if (!tab?.id || !tab.url) {
    setStatus('No active tab to track.')
    return
  }
  const origin = pageOrigin(tab.url)
  if (!origin) {
    setStatus('This page cannot be tracked.')
    return
  }
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] })
  if (!granted) {
    setStatus('Site permission was not granted.')
    return
  }
  const state = await loadState()
  const trackedOrigins = state.trackedOrigins.includes(origin)
    ? state.trackedOrigins
    : [...state.trackedOrigins, origin]
  await chrome.storage.local.set({ trackedOrigins })
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
  setStatus(`Tracking ${origin}`)
  await readPage()
}

async function readPage(): Promise<void> {
  const tab = await activeTab()
  if (!tab?.id) {
    return
  }
  try {
    const response: unknown = await chrome.tabs.sendMessage(tab.id, { type: 'read-page' })
    const event = readEvent(response)
    pageEvent = event
    if (!event) {
      if (summaryNode) {
        summaryNode.textContent = 'No episode found yet. Enter a number, or track this site first.'
      }
      return
    }
    if (episodeInput && !episodeInput.value) {
      episodeInput.value = String(event.episode)
    }
    if (summaryNode) {
      summaryNode.textContent = event.isMovie
        ? event.rawTitle
        : `${event.rawTitle} · episode ${event.episode}`
    }
  } catch {
    if (summaryNode) {
      summaryNode.textContent = 'Track this site to read the episode from the page.'
    }
  }
}

async function markCurrent(): Promise<void> {
  const event = eventFromForm(pageEvent?.episode ?? null)
  if (!event) {
    setStatus('Enter an episode number first.')
    return
  }
  await sendProgress(event)
}

async function markNext(): Promise<void> {
  const current = Number.parseInt(episodeInput?.value ?? '', 10)
  const base = Number.isFinite(current) && current >= 1 ? current : (pageEvent?.episode ?? 0)
  const next = base + 1
  if (episodeInput) {
    episodeInput.value = String(next)
  }
  const event = eventFromForm(next)
  if (!event) {
    setStatus('Enter an episode number first.')
    return
  }
  await sendProgress(event)
}

function eventFromForm(fallbackEpisode: number | null): ProgressEvent | null {
  if (!pageEvent) {
    return null
  }
  const parsed = Number.parseInt(episodeInput?.value ?? '', 10)
  const chosen = Number.isFinite(parsed) && parsed >= 1 ? parsed : fallbackEpisode
  if (chosen === null || chosen < 1) {
    return null
  }
  return { ...pageEvent, episode: chosen, isMovie: pageEvent.isMovie && chosen === 1 }
}

async function sendProgress(event: ProgressEvent): Promise<void> {
  const response = (await chrome.runtime.sendMessage({ type: 'save-progress', event })) as SaveResponse
  showSaveResult(response)
  if (response.ok && !response.matched) {
    renderUnmatched({ event, candidates: response.candidates })
  }
  if (response.ok && response.matched) {
    renderUnmatched(null)
  }
}

function showSaveResult(response: SaveResponse): void {
  if (response.ok && response.matched) {
    setStatus(`${response.label} ✔`)
    return
  }
  if (response.ok && !response.matched) {
    setStatus('Pick the matching anime below.')
    return
  }
  if (!response.ok && response.queued) {
    setStatus('Offline. This episode is queued and will retry.')
    return
  }
  setStatus(response.error)
}

function renderUnmatched(prompt: UnmatchedPrompt | null): void {
  if (!matchSection || !candidatesNode) {
    return
  }
  candidatesNode.replaceChildren()
  if (!prompt || prompt.candidates.length === 0) {
    matchSection.hidden = true
    return
  }
  matchSection.hidden = false
  for (const candidate of prompt.candidates) {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'candidate'
    button.textContent = candidate.title_english || candidate.title_romaji
    button.addEventListener('click', () => {
      void chooseCandidate(candidate)
    })
    candidatesNode.append(button)
  }
}

async function chooseCandidate(candidate: AnimeCandidate): Promise<void> {
  const response = (await chrome.runtime.sendMessage({
    type: 'confirm-match',
    anilistId: candidate.anilist_id,
  })) as SaveResponse
  showSaveResult(response)
  if (response.ok && response.matched) {
    renderUnmatched(null)
  }
}

async function activeTab(): Promise<chrome.tabs.Tab | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

function readEvent(response: unknown): ProgressEvent | null {
  if (!response || typeof response !== 'object' || !('event' in response)) {
    return null
  }
  const event = response.event
  if (!event || typeof event !== 'object') {
    return null
  }
  const page = event as ProgressEvent
  if (typeof page.rawTitle !== 'string' || typeof page.episode !== 'number' || typeof page.siteHost !== 'string') {
    return null
  }
  return page
}

function setStatus(text: string): void {
  if (statusNode) {
    statusNode.textContent = text
  }
}
