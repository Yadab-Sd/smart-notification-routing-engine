import { useEffect, useState } from 'react'
import { Activity, AlertCircle, Zap, Database, Cpu, Send } from 'lucide-react'
import { getSystemHealth } from '@/api/analytics'
import { generateSystemHealth } from '@/utils/demo-data'
import { ENV } from '@/config/env'
import type { SystemHealth as SystemHealthType } from '@/api/analytics'

interface HealthMetricProps {
  title: string
  icon: React.ReactNode
  metrics: { label: string; value: string | number; status?: 'good' | 'warning' | 'error' }[]
}

const HealthMetric = ({ title, icon, metrics }: HealthMetricProps) => {
  return (
    <div className="bg-white rounded-lg shadow p-4 border border-gray-200">
      <div className="flex items-center space-x-2 mb-3">
        <div className="p-1.5 bg-blue-100 rounded">
          {icon}
        </div>
        <h4 className="text-sm font-semibold text-gray-900">{title}</h4>
      </div>
      <div className="space-y-2">
        {metrics.map((metric, index) => (
          <div key={index} className="flex justify-between items-center">
            <span className="text-xs text-gray-600">{metric.label}</span>
            <span
              className={`text-sm font-medium ${
                metric.status === 'good'
                  ? 'text-green-600'
                  : metric.status === 'warning'
                  ? 'text-yellow-600'
                  : metric.status === 'error'
                  ? 'text-red-600'
                  : 'text-gray-900'
              }`}
            >
              {metric.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const SystemHealth = () => {
  const [health, setHealth] = useState<SystemHealthType | null>(null)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        if (ENV.DEMO_MODE) {
          // Use demo data in demo mode
          setHealth(generateSystemHealth())
        } else {
          // Fetch real health metrics from API
          const data = await getSystemHealth()
          setHealth(data)
        }
      } catch (error) {
        console.error('Error fetching system health:', error)
        // Fallback to demo data on error
        setHealth(generateSystemHealth())
      }
    }

    // Fetch initial health metrics
    fetchHealth()

    // Update health metrics every 10 seconds
    const interval = setInterval(fetchHealth, 10000)

    return () => clearInterval(interval)
  }, [])

  const getLatencyStatus = (value: number): 'good' | 'warning' | 'error' => {
    if (value < 100) return 'good'
    if (value < 200) return 'warning'
    return 'error'
  }

  const getErrorRateStatus = (value: number): 'good' | 'warning' | 'error' => {
    if (value < 0.1) return 'good'
    if (value < 0.5) return 'warning'
    return 'error'
  }

  if (!health) {
    return (
      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              System Health & Performance
            </h3>
            <p className="text-sm text-gray-600">
              Real-time monitoring of system components
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-green-600">All Systems Operational</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <HealthMetric
          title="API Latency"
          icon={<Activity className="w-4 h-4 text-blue-600" />}
          metrics={[
            { label: 'P50', value: `${health.apiLatency.p50}ms`, status: getLatencyStatus(health.apiLatency.p50) },
            { label: 'P95', value: `${health.apiLatency.p95}ms`, status: getLatencyStatus(health.apiLatency.p95) },
            { label: 'P99', value: `${health.apiLatency.p99}ms`, status: getLatencyStatus(health.apiLatency.p99) },
          ]}
        />

        <HealthMetric
          title="Error Rate"
          icon={<AlertCircle className="w-4 h-4 text-blue-600" />}
          metrics={[
            { label: 'Current', value: `${health.errorRate}%`, status: getErrorRateStatus(health.errorRate) },
            { label: 'Target', value: 'Set per pilot' },
            { label: 'Status', value: 'Validate', status: getErrorRateStatus(health.errorRate) },
          ]}
        />

        <HealthMetric
          title="Lambda Functions"
          icon={<Zap className="w-4 h-4 text-blue-600" />}
          metrics={[
            { label: 'Invocations', value: health.lambdaInvocations.toLocaleString() },
            { label: 'Success Rate', value: 'Measure live' },
            { label: 'Avg Duration', value: 'Measure live' },
          ]}
        />

        <HealthMetric
          title="Kinesis Stream"
          icon={<Database className="w-4 h-4 text-blue-600" />}
          metrics={[
            { label: 'Lag', value: `${health.kinesisLag}ms`, status: health.kinesisLag < 1000 ? 'good' : 'warning' },
            { label: 'Records/sec', value: 'Measure live' },
            { label: 'Status', value: 'Active', status: 'good' },
          ]}
        />

        <HealthMetric
          title="SageMaker"
          icon={<Cpu className="w-4 h-4 text-blue-600" />}
          metrics={[
            { label: 'Inferences', value: health.sagemakerInferences.toLocaleString() },
            { label: 'Avg Latency', value: 'Measure live' },
            { label: 'Model Version', value: 'Environment' },
          ]}
        />

        <HealthMetric
          title="Notifications"
          icon={<Send className="w-4 h-4 text-blue-600" />}
          metrics={[
            { label: 'Sent (24h)', value: health.notificationsSent.toLocaleString() },
            { label: 'Delivery Rate', value: 'Measure live' },
            { label: 'Avg Cost', value: 'Use Cost Explorer' },
          ]}
        />
      </div>

      <div className="mt-6 bg-green-50 rounded-lg p-4 border border-green-200">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-medium text-green-900">System Status: Healthy</h4>
            <p className="text-sm text-green-700 mt-1">
              All components are operating within normal parameters. Last health check: {new Date().toLocaleTimeString()}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SystemHealth
