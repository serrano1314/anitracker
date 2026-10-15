import { ExtensionApiError, postMatch, postProgress, shouldQueue } from './api'
import type { ConfirmMessage, ProgressEvent, SaveMessage, SaveResponse } from './messages'
import { isProgressEvent } from './messages'
import { enqueueProgress, removeProgress } from './queue'
import { loadState, pageOrigin } from './storage'

chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create('retry-queue', { periodInMinutes: 1 })
  void flushQueue()
})

chrome.runtime.onStartup.addListener(() => {
  void flushQueue()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'retry-queue') {
    void flushQueue()
  }
})

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete' || !tab.url) {
    return
  }
  void injectIfTracked(tabId, tab.url)
})

chrome.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
  if (isSaveMessage(message)) {
    void handleSave(message.event, sender.tab?.id).then(sendResponse)
    return true
  }
  if (isConfirmMessage(message)) {
    void confirmMatch(message.anilistId, sender.tab?.id).then(sendResponse)
    return true
  }
  return undefined
})

async function handleSave(event: ProgressEvent, tabId?: number): Promise<SaveResponse> {
  const toastTab = tabId ?? (await activeTabId())
  const state = await loadState()
  if (!state.token) {
    return { ok: false, queued: false, error: 'Paste an extension token first.' }
  }
  try {
    const result = await postProgress(state.apiBase, state.token, event)
    if (result.matched) {
      await chrome.storage.local.set({ unmatched: null })
      const title = result.anime.title_english || result.anime.title_romaji
      const label = `${title} — Episode ${result.episode} saved`
      await showToast(toastTab, `${label} ✔`)
      return { ok: true, matched: true, label }
    }
    await chrome.storage.local.set({ unmatched: { event, candidates: result.candidates } })
    await showToast(toastTab, 'No library match. Open the extension to choose the anime.')
    return { ok: true, matched: false, candidates: result.candidates }
  } catch (error) {
    if (error instanceof ExtensionApiError && !shouldQueue(error.status)) {
      return { ok: false, queued: false, error: error.message }
    }
    await chrome.storage.local.set({ queue: enqueueProgress(state.queue, event) })
    await showToast(toastTab, 'Saved offline. Will retry when the API is back.')
    return { ok: false, queued: true }
  }
}

async function confirmMatch(anilistId: number, tabId?: number): Promise<SaveResponse> {
  const state = await loadState()
  if (!state.token || !state.unmatched) {
    return { ok: false, queued: false, error: 'Nothing to match.' }
  }
  try {
    await postMatch(state.apiBase, state.token, state.unmatched.event, anilistId)
  } catch (error) {
    const message = error instanceof ExtensionApiError ? error.message : 'Could not save the match.'
    if (error instanceof ExtensionApiError && shouldQueue(error.status)) {
      return { ok: false, queued: false, error: 'API unreachable. Try the match again.' }
    }
    return { ok: false, queued: false, error: message }
  }
  return handleSave(state.unmatched.event, tabId)
}

async function flushQueue(): Promise<void> {
  const state = await loadState()
  if (!state.token || state.queue.length === 0) {
    return
  }
  let queue = state.queue
  for (const event of [...queue]) {
    try {
      const result = await postProgress(state.apiBase, state.token, event)
      queue = removeProgress(queue, event)
      if (result.matched) {
        const title = result.anime.title_english || result.anime.title_romaji
        await showToast(await activeTabId(), `${title} — Episode ${result.episode} saved ✔`)
      } else {
        await chrome.storage.local.set({ unmatched: { event, candidates: result.candidates } })
      }
    } catch (error) {
      if (error instanceof ExtensionApiError && error.status === 422) {
        queue = removeProgress(queue, event)
        continue
      }
      break
    }
  }
  await chrome.storage.local.set({ queue })
}

async function injectIfTracked(tabId: number, pageUrl: string): Promise<void> {
  const origin = pageOrigin(pageUrl)
  if (!origin) {
    return
  }
  const state = await loadState()
  if (!state.trackedOrigins.includes(origin)) {
    return
  }
  const granted = await chrome.permissions.contains({ origins: [`${origin}/*`] })
  if (!granted) {
    return
  }
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js'],
  })
}

async function activeTabId(): Promise<number | undefined> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.id
}

async function showToast(tabId: number | undefined, text: string): Promise<void> {
  if (tabId === undefined) {
    return
  }
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'show-toast', text })
  } catch {
    // The content script is only present on sites the user chose to track.
  }
}

function isSaveMessage(value: unknown): value is SaveMessage {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as SaveMessage).type === 'save-progress' &&
      isProgressEvent((value as SaveMessage).event),
  )
}

function isConfirmMessage(value: unknown): value is ConfirmMessage {
  return Boolean(
    value &&
      typeof value === 'object' &&
      (value as ConfirmMessage).type === 'confirm-match' &&
      typeof (value as ConfirmMessage).anilistId === 'number',
  )
}
