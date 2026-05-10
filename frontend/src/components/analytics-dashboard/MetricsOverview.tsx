import { useEffect, useState } from 'react'
import { Activity, Users, TrendingUp, Target } from 'lucide-react'
import { generateMetricsOverview } from '@/utils/demo-data'
import type { MetricsOverview as MetricsOverviewType } from '@/types'

interface MetricCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: string
  trendUp?: boolean
}

const MetricCard = ({ title, value, icon, trend, trendUp }: MetricCardProps) => {
  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            {icon}
          </div>
          <h3 className="text-sm font-medium text-gray-600">{title}</h3>
        </div>
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {trend && (
            <p className={`text-sm mt-1 ${trendUp ? 'text-green-600' : 'text-red-600'}`}>
              {trendUp ? '↑' : '↓'} {trend}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

const MetricsOverview = () => {
  const [metrics, setMetrics] = useState<MetricsOverviewType | null>(null)

  useEffect(() => {
    // Generate initial metrics
    setMetrics(generateMetricsOverview())

    // Update metrics every 5 seconds to simulate live data
    const interval = setInterval(() => {
      setMetrics(generateMetricsOverview())
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  if (!metrics) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 border border-gray-200 animate-pulse">
            <div className="h-20"></div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <MetricCard
        title="Total Events"
        value={metrics.totalEvents.toLocaleString()}
        icon={<Activity className="w-6 h-6 text-blue-600" />}
        trend="12.5%"
        trendUp={true}
      />
      <MetricCard
        title="Active Users"
        value={metrics.activeUsers.toLocaleString()}
        icon={<Users className="w-6 h-6 text-blue-600" />}
        trend="8.3%"
        trendUp={true}
      />
      <MetricCard
        title="Avg Engagement Rate"
        value={`${metrics.avgEngagementRate}%`}
        icon={<TrendingUp className="w-6 h-6 text-blue-600" />}
        trend="45-60% vs baseline"
        trendUp={true}
      />
      <MetricCard
        title="ML Model AUC"
        value={metrics.modelAUC}
        icon={<Target className="w-6 h-6 text-blue-600" />}
        trend="0.02 improvement"
        trendUp={true}
      />
    </div>
  )
}

export default MetricsOverview
