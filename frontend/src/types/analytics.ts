export interface MetricsOverview {
  totalEvents: number
  activeUsers: number
  avgEngagementRate: number
  modelAUC: number
}

export interface EngagementData {
  date: string
  baseline: number
  ml: number
  uplift: number
}

export interface HourlyHeatmapData {
  hour: string
  Sun: number
  Mon: number
  Tue: number
  Wed: number
  Thu: number
  Fri: number
  Sat: number
}

export interface MLTrainingData {
  epoch: number
  trainAUC: number
  valAUC: number
}
