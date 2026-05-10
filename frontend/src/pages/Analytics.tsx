import Layout from '@/components/common/Layout'
import MetricsOverview from '@/components/analytics-dashboard/MetricsOverview'
import EngagementTrends from '@/components/analytics-dashboard/EngagementTrends'
import MLModelPerformance from '@/components/analytics-dashboard/MLModelPerformance'
import SendTimeHeatmap from '@/components/analytics-dashboard/SendTimeHeatmap'
import SystemHealth from '@/components/analytics-dashboard/SystemHealth'
import ImpactCalculator from '@/components/analytics-dashboard/ImpactCalculator'

const Analytics = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Admin Analytics Dashboard</h2>
          <p className="mt-2 text-gray-600">
            Monitor system performance, ML model metrics, and business impact across all customers
          </p>
        </div>

        {/* KPI Metrics Overview */}
        <MetricsOverview />

        {/* Engagement Trends: Baseline vs ML */}
        <EngagementTrends />

        {/* ML Model Performance and Send-Time Heatmap */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MLModelPerformance />
          <SendTimeHeatmap />
        </div>

        {/* System Health Monitoring */}
        <SystemHealth />

        {/* Business Impact Calculator */}
        <ImpactCalculator />
      </div>
    </Layout>
  )
}

export default Analytics
