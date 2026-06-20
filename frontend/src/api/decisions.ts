import { apiClient } from './client'
import type { AttentionSummaryResponse, DecisionRequest, DecisionResponse } from '@/types'

/**
 * Preview optimal send time without scheduling
 */
export const previewDecision = async (
  request: DecisionRequest
): Promise<DecisionResponse> => {
  const response = await apiClient.post<DecisionResponse>(
    '/v1/decisions/preview',
    {
      ...request,
      schedule: false,
    }
  )
  return response.data
}

/**
 * Get optimal send time and schedule notification
 */
export const scheduleDecision = async (
  request: DecisionRequest
): Promise<DecisionResponse> => {
  const response = await apiClient.post<DecisionResponse>(
    '/v1/decisions/schedule',
    {
      ...request,
      schedule: true,
    }
  )
  return response.data
}

export const getAttentionSummary = async (params?: {
  sourceId?: string
  userId?: string
  limit?: number
}): Promise<AttentionSummaryResponse> => {
  const response = await apiClient.get<AttentionSummaryResponse>(
    '/v1/attention/summary',
    { params }
  )
  return response.data
}
