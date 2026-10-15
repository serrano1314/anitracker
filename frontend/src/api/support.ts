import type { SupportTicketRequest } from '../types/support'
import { apiFetch, readApiError } from './client'

export async function submitSupportTicket(body: SupportTicketRequest): Promise<void> {
  const response = await apiFetch('/api/v1/support/tickets', {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw await readApiError(response)
  }
}
