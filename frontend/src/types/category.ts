import type { MessageCategory, PriorityClass } from './decision'

export type DeliveryMode = 'IMMEDIATE' | 'OPTIMIZED'
export type NotificationChannel = 'AUTO' | 'EMAIL' | 'SMS' | 'PUSH'
export type RiskClass = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'REGULATED'

export interface NotificationCategory {
  organizationId?: string
  categoryId: string
  displayName: string
  description?: string
  defaultDeliveryMode: DeliveryMode
  allowedChannels?: NotificationChannel[]
  messageCategory: MessageCategory
  riskClass: RiskClass
  priorityClass: PriorityClass
  businessValue: number
  urgency: number
  maxDelayHours: number
  quietHoursRespect?: boolean
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CategoryListResponse {
  organizationId: string
  categories: NotificationCategory[]
  count: number
}
