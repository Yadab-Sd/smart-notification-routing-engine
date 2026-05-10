export type EventType = 'PLAY_MOVIE' | 'CLICK' | 'VIEW_PAGE'

export interface UserEvent {
  userId: string
  type: EventType
  ts: string
  attrs?: Record<string, string>
}

export interface EventIngestionRequest {
  userId: string
  type: EventType
  attrs?: Record<string, string>
}
