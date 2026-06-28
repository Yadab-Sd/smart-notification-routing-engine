import { apiClient } from './client'
import type { Audience, AudienceListResponse } from '@/types'

export const listAudiences = async (): Promise<AudienceListResponse> => {
  const response = await apiClient.get<AudienceListResponse>('/v1/audiences')
  return response.data
}

export const createAudience = async (payload: Audience): Promise<Audience> => {
  const response = await apiClient.post<Audience>('/v1/audiences', payload)
  return response.data
}

export const updateAudience = async (audienceId: string, payload: Audience): Promise<Audience> => {
  const response = await apiClient.put<Audience>(`/v1/audiences/${encodeURIComponent(audienceId)}`, payload)
  return response.data
}

export const deleteAudience = async (audienceId: string): Promise<void> => {
  await apiClient.delete(`/v1/audiences/${encodeURIComponent(audienceId)}`)
}
