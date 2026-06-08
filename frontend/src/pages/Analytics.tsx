import { useState } from 'react'
import Layout from '@/components/common/Layout'
import MetricsOverview from '@/components/analytics-dashboard/MetricsOverview'
import EngagementTrends from '@/components/analytics-dashboard/EngagementTrends'
import MLModelPerformance from '@/components/analytics-dashboard/MLModelPerformance'
import SendTimeHeatmap from '@/components/analytics-dashboard/SendTimeHeatmap'
import SystemHealth from '@/components/analytics-dashboard/SystemHealth'
import ImpactCalculator from '@/components/analytics-dashboard/ImpactCalculator'
import { Calendar, Download, RefreshCw, Filter } from 'lucide-react'

const ranges = ['24 h', '7 d', '30 d', '90 d']

const Analytics = () => {
  const [range, setRange] = useState('7 d')
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = () => {
    setRefreshing(true)
    setTimeout(() => setRefreshing(false), 700)
  }

  return (
    <Layout
      actions={
        <>
          <div className="hidden md:inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-soft">
            {ranges.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  range === r ? 'bg-primary-600 text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
          <button className="btn-secondary">
            <Filter size={16} /> Filters
          </button>
          <button onClick={handleRefresh} className="btn-secondary" disabled={refreshing}>
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button className="btn-primary">
            <Download size={16} /> Export
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="md:hidden flex items-center justify-between gap-2 card py-3">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Calendar size={14} /> Period
          </div>
          <select className="select w-32" value={range} onChange={(e) => setRange(e.target.value)}>
            {ranges.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>

        <MetricsOverview />
        <EngagementTrends />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MLModelPerformance />
          <SendTimeHeatmap />
        </div>

        <SystemHealth />
        <ImpactCalculator />
      </div>
    </Layout>
  )
}

export default Analytics
