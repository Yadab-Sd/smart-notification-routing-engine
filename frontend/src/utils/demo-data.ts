import { format, subDays } from 'date-fns'
import type {
  MetricsOverview,
  EngagementData,
  HourlyHeatmapData,
  MLTrainingData,
} from '@/types'

/**
 * Generate engagement data comparing baseline vs ML-optimized
 * Shows 40-60% improvement in engagement rates
 */
export const generateEngagementData = (days: number): EngagementData[] => {
  const data: EngagementData[] = []
  const baselineRate = 0.035 // 3.5% baseline click rate
  const mlRate = 0.058 // 5.8% ML-optimized rate (~65% improvement)

  for (let i = 0; i < days; i++) {
    const date = subDays(new Date(), days - i - 1)

    // Add realistic noise and weekly patterns
    const dayOfWeek = date.getDay()
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6

    // Weekend boost
    const weekendBoost = isWeekend ? 0.003 : 0

    // Add some realistic noise
    const noiseBaseline = (Math.random() - 0.5) * 0.005
    const noiseML = (Math.random() - 0.5) * 0.008

    const baseline = Math.max(0.01, baselineRate + weekendBoost + noiseBaseline)
    const ml = Math.max(0.02, mlRate + weekendBoost * 1.5 + noiseML)

    data.push({
      date: format(date, 'MMM dd'),
      baseline: baseline * 100, // Convert to percentage
      ml: ml * 100,
      uplift: ((ml - baseline) / baseline) * 100,
    })
  }

  return data
}

/**
 * Generate hourly heatmap data showing engagement probability by hour and day
 * Higher engagement in evenings and weekends
 */
export const generateHourlyHeatmap = (): HourlyHeatmapData[] => {
  const data: HourlyHeatmapData[] = []
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  for (let hour = 0; hour < 24; hour++) {
    const row: any = {
      hour: `${hour.toString().padStart(2, '0')}:00`,
    }

    days.forEach((day) => {
      // Base probability
      let prob = 0.3

      // Evening boost (6 PM - 10 PM)
      if (hour >= 18 && hour <= 22) {
        prob += 0.3
      }

      // Morning boost (9 AM - 11 AM)
      if (hour >= 9 && hour <= 11) {
        prob += 0.15
      }

      // Lunch boost (12 PM - 1 PM)
      if (hour >= 12 && hour <= 13) {
        prob += 0.1
      }

      // Late night penalty (12 AM - 6 AM)
      if (hour >= 0 && hour <= 6) {
        prob -= 0.15
      }

      // Weekend boost
      if (day === 'Sat' || day === 'Sun') {
        prob += 0.1
      }

      // Weekday work hours penalty (Mon-Fri 9-5)
      if (
        (day === 'Mon' ||
          day === 'Tue' ||
          day === 'Wed' ||
          day === 'Thu' ||
          day === 'Fri') &&
        hour >= 9 &&
        hour <= 17
      ) {
        prob -= 0.05
      }

      // Add some noise
      prob += (Math.random() - 0.5) * 0.1

      // Clamp between 0.1 and 0.9
      prob = Math.max(0.1, Math.min(0.9, prob))

      row[day] = Number(prob.toFixed(2))
    })

    data.push(row as HourlyHeatmapData)
  }

  return data
}

/**
 * Generate ML model training curve data
 * Shows model improving from 0.65 to 0.78 AUC over 200 epochs
 */
export const generateMLTrainingCurve = (): MLTrainingData[] => {
  const data: MLTrainingData[] = []
  let trainAUC = 0.65
  let valAUC = 0.62

  for (let epoch = 1; epoch <= 200; epoch++) {
    // Gradual improvement with diminishing returns
    const improvementFactor = 1 - epoch / 250
    trainAUC = Math.min(
      0.89,
      trainAUC +
        (0.89 - trainAUC) * 0.05 * improvementFactor +
        (Math.random() - 0.5) * 0.01
    )
    valAUC = Math.min(
      0.78,
      valAUC +
        (0.78 - valAUC) * 0.04 * improvementFactor +
        (Math.random() - 0.5) * 0.015
    )

    // Validation should be lower than training (realistic)
    valAUC = Math.min(valAUC, trainAUC - 0.05)

    data.push({
      epoch,
      trainAUC: Number(trainAUC.toFixed(3)),
      valAUC: Number(valAUC.toFixed(3)),
    })
  }

  return data
}

/**
 * Generate metrics overview for KPI cards
 */
export const generateMetricsOverview = (): MetricsOverview => {
  // Simulate growth
  const baseEvents = 2400000
  const baseUsers = 15234
  const baseEngagement = 5.8
  const modelAUC = 0.78

  // Add some variation to make it look live
  const variation = (Math.random() - 0.5) * 0.02

  return {
    totalEvents: Math.floor(baseEvents * (1 + variation)),
    activeUsers: Math.floor(baseUsers * (1 + variation)),
    avgEngagementRate: Number((baseEngagement * (1 + variation)).toFixed(2)),
    modelAUC: Number((modelAUC + (Math.random() - 0.5) * 0.01).toFixed(3)),
  }
}

/**
 * Generate system health metrics
 */
export const generateSystemHealth = () => {
  return {
    apiLatency: {
      p50: Math.floor(45 + Math.random() * 10),
      p95: Math.floor(85 + Math.random() * 15),
      p99: Math.floor(120 + Math.random() * 30),
    },
    errorRate: Number((Math.random() * 0.5).toFixed(2)), // 0-0.5% error rate
    lambdaInvocations: Math.floor(450000 + Math.random() * 50000),
    kinesisLag: Math.floor(Math.random() * 500), // milliseconds
    sagemakerInferences: Math.floor(125000 + Math.random() * 15000),
    notificationsSent: Math.floor(89000 + Math.random() * 5000),
  }
}

/**
 * Generate user cohort data
 */
export const generateCohortData = () => {
  const cohorts = ['Power Users', 'Regular Users', 'Occasional Users', 'New Users']

  return cohorts.map((cohort, index) => ({
    name: cohort,
    users: Math.floor((15234 / (index + 1)) * (1 + Math.random() * 0.2)),
    engagement: Number((0.08 / (index + 1) * (1 + Math.random() * 0.3)).toFixed(3)),
    revenue: Math.floor((50000 / (index + 1)) * (1 + Math.random() * 0.25)),
  }))
}

/**
 * Generate hourly activity data for the last 24 hours
 */
export const generateHourlyActivity = () => {
  const data = []
  const now = new Date()

  for (let i = 23; i >= 0; i--) {
    const hour = new Date(now.getTime() - i * 60 * 60 * 1000)
    const hourLabel = format(hour, 'HH:mm')

    // Simulate daily pattern
    const hourOfDay = hour.getHours()
    let baseActivity = 1000

    // Peak hours: 9-11 AM and 6-9 PM
    if ((hourOfDay >= 9 && hourOfDay <= 11) || (hourOfDay >= 18 && hourOfDay <= 21)) {
      baseActivity = 3500
    }
    // Low hours: 12-6 AM
    else if (hourOfDay >= 0 && hourOfDay <= 6) {
      baseActivity = 200
    }

    data.push({
      time: hourLabel,
      events: Math.floor(baseActivity + Math.random() * baseActivity * 0.3),
      predictions: Math.floor(
        (baseActivity * 0.4) + Math.random() * baseActivity * 0.15
      ),
      sends: Math.floor(
        (baseActivity * 0.35) + Math.random() * baseActivity * 0.12
      ),
    })
  }

  return data
}
