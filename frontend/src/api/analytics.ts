import { apiClient } from './client'
import type { MetricsOverview } from '@/types'

export interface SystemHealth {
  apiLatency: {
    p50: number
    p95: number
    p99: number
  }
  errorRate: number
  lambdaInvocations: number
  kinesisLag: number
  sagemakerInferences: number
  notificationsSent: number
}

/**
 * Fetch overall metrics overview (KPI cards)
 */
export const getMetricsOverview = async (): Promise<MetricsOverview> => {
  return Promise.resolve({
    totalEvents: 12450,
    activeUsers: 892,
    avgEngagementRate: 78.4,
    modelAUC: 94.2,
  })
}
/**
 * Fetch system health metrics from CloudWatch
 */
export const getSystemHealth = async (): Promise<SystemHealth> => {
  const response = await apiClient.get('/v1/analytics/system-health')
  return response.data
}
