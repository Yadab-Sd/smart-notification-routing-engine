import { apiClient } from './client'
import type {
  Campaign,
  CampaignLaunch,
  CampaignLaunchListResponse,
  CampaignLaunchRequest,
  CampaignListResponse,
} from '@/types'

export const listCampaigns = async (): Promise<CampaignListResponse> => {
  const response = await apiClient.get<CampaignListResponse>('/v1/campaigns')
  return response.data
}

export const createCampaign = async (payload: Campaign): Promise<Campaign> => {
  const response = await apiClient.post<Campaign>('/v1/campaigns', payload)
  return response.data
}

export const updateCampaign = async (campaignId: string, payload: Campaign): Promise<Campaign> => {
  const response = await apiClient.put<Campaign>(`/v1/campaigns/${encodeURIComponent(campaignId)}`, payload)
  return response.data
}

export const deleteCampaign = async (campaignId: string): Promise<void> => {
  await apiClient.delete(`/v1/campaigns/${encodeURIComponent(campaignId)}`)
}

export const recordCampaignLaunch = async (
  payload: CampaignLaunchRequest
): Promise<CampaignLaunch> => {
  const response = await apiClient.post<CampaignLaunch>('/v1/campaigns/launches', payload)
  return response.data
}

export const listCampaignLaunches = async (params?: {
  campaignId?: string
  limit?: number
}): Promise<CampaignLaunchListResponse> => {
  const response = await apiClient.get<CampaignLaunchListResponse>('/v1/campaigns/launches', { params })
  return response.data
}
