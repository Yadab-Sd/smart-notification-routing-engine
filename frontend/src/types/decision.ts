export interface DecisionRequest {
  userId: string
  windowStart: number // Unix epoch seconds
  windowEnd: number // Unix epoch seconds
  schedule?: boolean
}

export interface DecisionResponse {
  hour: number // 0-23
  probability: number // 0-1
  scheduled?: boolean
}
