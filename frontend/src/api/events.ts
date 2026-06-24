import { apiClient } from './client'
import type { EventIngestionRequest } from '@/types'

/**
 * Ingest a user event
 */
export const ingestEvent = async (event: EventIngestionRequest): Promise<void> => {
  const payload = {
    ...event,
    ts: new Date().toISOString(),
  }
  await apiClient.post('/v1/events', payload)
}

export const ingestNotificationEvent = async (
  payload: Record<string, unknown>
): Promise<void> => {
  await apiClient.post('/v1/events', payload)
}
