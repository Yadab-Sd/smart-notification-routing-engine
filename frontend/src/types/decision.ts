export interface DecisionRequest {
  userId: string
  windowStart: number // Unix epoch seconds
  windowEnd: number // Unix epoch seconds
  schedule?: boolean
  auditPreview?: boolean
  channel?: 'AUTO' | 'EMAIL' | 'SMS' | 'PUSH'
  sourceId?: string
  categoryId?: string
  campaignId?: string
  templateId?: string
  timezone?: string
  messageCategory?: MessageCategory
  priorityClass?: PriorityClass
  businessValue?: number // 0.0-10.0
  urgency?: number // 0.0-1.0
  message?: string
  metadata?: Record<string, unknown>
  categoryDefaults?: Record<string, unknown>
  effectivePolicy?: Record<string, unknown>
  policyOverrides?: Record<string, boolean>
}

export interface DecisionResponse {
  userId?: string
  hour: number // 0-23
  probability: number // 0-1
  modelSource?: 'SAGEMAKER' | 'FALLBACK_HEURISTIC'
  modelConfidence?: 'TRAINED_MODEL' | 'LOW_STARTUP_ESTIMATE'
  modelExplanation?: string
  sendNowTime?: string
  sendNowHour?: number // 0-23
  sendNowProbability?: number // 0-1
  recommendedSendTime?: string
  attentionDecision?: 'SEND' | 'DEFER'
  attentionCost?: number
  attentionValue?: number
  attentionMargin?: number
  attentionReason?: string
  fatigueScore?: number
  sourceTrustScore?: number
  sourceId?: string
  categoryId?: string
  decisionId?: string
  categoryDefaults?: Record<string, unknown>
  effectivePolicy?: Record<string, unknown>
  policyOverrides?: Record<string, boolean>
  overrideCount?: number
  overrideMagnitude?: number
  previewOnly?: boolean
  scheduled?: boolean
  scheduleId?: string
  scheduledTime?: string
  scheduleSkippedReason?: string
}

export interface BatchDecisionRequest {
  campaignId: string
  categoryId?: string
  userIds: string[]
  windowStart: number
  windowEnd: number
  channel?: 'AUTO' | 'EMAIL' | 'SMS' | 'PUSH'
  sourceId?: string
  templateId?: string
  notificationType?: string
  timezone?: string
  messageCategory?: MessageCategory
  priorityClass?: PriorityClass
  businessValue?: number
  urgency?: number
  message?: string
  metadata?: Record<string, unknown>
  categoryDefaults?: Record<string, unknown>
  effectivePolicy?: Record<string, unknown>
  policyOverrides?: Record<string, boolean>
}

export interface BatchDecisionResponse {
  campaignId: string
  categoryId?: string
  sourceId: string
  previewOnly: boolean
  recipientCount: number
  previewedCount: number
  sendCount: number
  deferCount: number
  notFoundCount: number
  sendRate: number
  deferRate: number
  avgAttentionCost: number
  avgAttentionValue: number
  avgFatigueScore: number
  avgProbability: number
  estimatedAttentionSaved: number
  modelSource?: 'SAGEMAKER' | 'FALLBACK_HEURISTIC'
  modelConfidence?: 'TRAINED_MODEL' | 'LOW_STARTUP_ESTIMATE'
  modelExplanation?: string
  recommendation: string
  results: Array<DecisionResponse & {
    status: 'PREVIEWED' | 'USER_NOT_FOUND'
  }>
}

export interface AttentionSummaryResponse {
  scope: {
    sourceId: string
    userId: string
    limit: number
  }
  totalDecisions: number
  sendDecisions: number
  deferredDecisions: number
  sendRate: number
  deferRate: number
  avgAttentionCost: number
  avgAttentionValue: number
  avgFatigueScore: number
  avgSourceTrustScore: number
  attentionProtected: number
  estimatedAttentionSaved: number
  recommendation: string
  topSources: Array<{
    sourceId: string
    decisions: number
  }>
  recentDecisions: Array<{
    decisionId: string
    userId: string
    sourceId: string
    channel: 'AUTO' | 'EMAIL' | 'SMS' | 'PUSH'
    messageCategory: MessageCategory
    priorityClass: PriorityClass
    attentionDecision: 'SEND' | 'DEFER'
    modelSource?: 'SAGEMAKER' | 'FALLBACK_HEURISTIC'
    modelConfidence?: 'TRAINED_MODEL' | 'LOW_STARTUP_ESTIMATE'
    attentionCost: number
    attentionValue: number
    fatigueScore: number
    sourceTrustScore: number
    reason: string
    createdAt?: string
  }>
}

export type MessageCategory =
  | 'GENERAL'
  | 'MARKETING'
  | 'PROMOTION'
  | 'NEWSLETTER'
  | 'TRANSACTIONAL'
  | 'SECURITY'
  | 'EMERGENCY'

export type PriorityClass =
  | 'LOW'
  | 'STANDARD'
  | 'HIGH'
  | 'URGENT'
  | 'CRITICAL'
  | 'EMERGENCY'
