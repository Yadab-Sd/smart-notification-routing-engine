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
