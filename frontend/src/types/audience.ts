export interface Audience {
  audienceId: string
  organizationId?: string
  name: string
  description?: string
  userIds: string[]
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AudienceListResponse {
  organizationId: string
  count: number
  audiences: Audience[]
}
