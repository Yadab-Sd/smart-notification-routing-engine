export interface User {
  pk?: string
  sk?: string
  userId?: string
  name?: string
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  counters: {
    events: number
    clicks: number
    sends: number
  }
  createdAt?: string
  createdBy?: string
  lastSeenAt?: string
  prefs?: string | UserPreferences
}

export interface UserPreferences {
  timezone?: string
  quiet_hours?: {
    start: number
    end: number
  }
  channels?: string[]
  frequency?: number
}

export interface UserProfileResponse {
  user: User
}
