export type CampaignDeliveryMode = 'IMMEDIATE' | 'OPTIMIZED'

export interface Campaign {
  campaignId: string
  organizationId?: string
  name: string
  description?: string
  categoryId?: string
  eventType: string
  subject?: string
  message: string
  channel: 'AUTO' | 'EMAIL' | 'SMS' | 'PUSH'
  messageCategory: 'GENERAL' | 'MARKETING' | 'PROMOTION' | 'NEWSLETTER' | 'TRANSACTIONAL' | 'SECURITY' | 'EMERGENCY'
  priorityClass: 'LOW' | 'STANDARD' | 'HIGH' | 'URGENT' | 'CRITICAL' | 'EMERGENCY'
  businessValue: number
  urgency: number
  maxDelayHours: number
  defaultDeliveryMode: CampaignDeliveryMode
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CampaignListResponse {
  organizationId: string
  count: number
  campaigns: Campaign[]
}

export interface CampaignLaunchRequest {
  campaignId: string
  categoryId?: string
  audienceId?: string
  sourceId?: string
  deliveryMode: CampaignDeliveryMode
  recipientCount: number
  previewedCount: number
  sendReadyCount: number
  deferredCount: number
  deferredIncludedCount: number
  notFoundSkippedCount: number
  acceptedCount: number
  failedCount: number
  avgAttentionCost?: number
  avgAttentionValue?: number
  avgFatigueScore?: number
  avgProbability?: number
  estimatedAttentionSaved?: number
  modelSource?: 'SAGEMAKER' | 'FALLBACK_HEURISTIC'
  modelConfidence?: 'TRAINED_MODEL' | 'LOW_STARTUP_ESTIMATE'
  recommendation?: string
}

export interface CampaignLaunch extends CampaignLaunchRequest {
  organizationId?: string
  launchId: string
  createdAt: string
}

export interface CampaignLaunchListResponse {
  organizationId: string
  campaignId: string
  count: number
  launches: CampaignLaunch[]
}
