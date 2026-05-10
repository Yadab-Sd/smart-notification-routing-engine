import { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { generateEngagementData } from '@/utils/demo-data'

const EngagementTrends = () => {
  const data = useMemo(() => generateEngagementData(30), [])

  // Calculate average improvement
  const avgImprovement = useMemo(() => {
    const totalUplift = data.reduce((sum, d) => sum + d.uplift, 0)
    return (totalUplift / data.length).toFixed(1)
  }, [data])

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Engagement Rate: Baseline vs ML-Optimized
        </h3>
        <p className="text-sm text-gray-600">
          Comparing standard 9 AM send time vs ML-predicted optimal send times
        </p>
        <div className="mt-2 inline-flex items-center px-3 py-1 rounded-full bg-green-100 text-green-800 text-sm font-medium">
          <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z"
              clipRule="evenodd"
            />
          </svg>
          Average {avgImprovement}% improvement
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
          />
          <YAxis
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            label={{
              value: 'Engagement Rate (%)',
              angle: -90,
              position: 'insideLeft',
              style: { fontSize: 12, fill: '#6b7280' },
            }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              fontSize: 12,
            }}
            formatter={(value: number) => `${value.toFixed(2)}%`}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="baseline"
            stroke="#9ca3af"
            strokeWidth={2}
            dot={false}
            name="Baseline (Fixed 9 AM)"
          />
          <Line
            type="monotone"
            dataKey="ml"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="ML-Optimized"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-3 gap-4 text-center border-t border-gray-200 pt-4">
        <div>
          <p className="text-sm text-gray-600">Baseline Avg</p>
          <p className="text-xl font-semibold text-gray-900">
            {(data.reduce((sum, d) => sum + d.baseline, 0) / data.length).toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">ML-Optimized Avg</p>
          <p className="text-xl font-semibold text-blue-600">
            {(data.reduce((sum, d) => sum + d.ml, 0) / data.length).toFixed(2)}%
          </p>
        </div>
        <div>
          <p className="text-sm text-gray-600">Improvement</p>
          <p className="text-xl font-semibold text-green-600">
            +{avgImprovement}%
          </p>
        </div>
      </div>
    </div>
  )
}

export default EngagementTrends
