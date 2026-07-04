import type { MessageCategory } from './decision'
import type { NotificationChannel } from './category'

export interface NotificationTemplate {
  templateId: string
  organizationId?: string
  name: string
  description?: string
  channel: NotificationChannel
  messageCategory: MessageCategory
  subject?: string
  body: string
  variables?: string[]
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface TemplateListResponse {
  organizationId: string
  templates: NotificationTemplate[]
  count: number
}
