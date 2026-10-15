import type { ExtensionToken, ExtensionTokenCreated } from '../types/extension'
import { apiFetch, readApiError, readJson } from './client'

export function fetchExtensionTokens(): Promise<ExtensionToken[]> {
  return apiFetch('/api/v1/extension/tokens').then((response) => readJson<ExtensionToken[]>(response))
}

export function createExtensionToken(name: string): Promise<ExtensionTokenCreated> {
  return apiFetch('/api/v1/extension/tokens', {
    method: 'POST',
    body: JSON.stringify({ name }),
  }).then((response) => readJson<ExtensionTokenCreated>(response))
}

export async function revokeExtensionToken(tokenId: string): Promise<void> {
  const response = await apiFetch(`/api/v1/extension/tokens/${tokenId}`, { method: 'DELETE' })
  if (!response.ok) {
    throw await readApiError(response)
  }
}
