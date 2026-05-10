export interface User {
  pk: string
  sk: string
  email: string
  counters: {
    events: number
    clicks: number
    sends: number
  }
  lastSeenAt: string
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
