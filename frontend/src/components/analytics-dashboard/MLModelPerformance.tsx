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
import { generateMLTrainingCurve } from '@/utils/demo-data'

const MLModelPerformance = () => {
  const data = useMemo(() => generateMLTrainingCurve(), [])

  // Get final epoch metrics
  const finalMetrics = data[data.length - 1]

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          ML Model Training Performance
        </h3>
        <p className="text-sm text-gray-600">
          XGBoost model training curve showing AUC-PR over 200 epochs
        </p>
        <div className="mt-2 flex items-center space-x-4">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-blue-100 text-blue-800 text-sm font-medium">
            Train AUC: {finalMetrics.trainAUC}
          </div>
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-sm font-medium">
            Val AUC: {finalMetrics.valAUC}
          </div>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={data}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="epoch"
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            label={{
              value: 'Epoch',
              position: 'insideBottom',
              offset: -5,
              style: { fontSize: 12, fill: '#6b7280' },
            }}
          />
          <YAxis
            domain={[0.6, 0.9]}
            tick={{ fontSize: 12 }}
            stroke="#9ca3af"
            label={{
              value: 'AUC-PR Score',
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
            formatter={(value: number) => value.toFixed(3)}
          />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="line"
          />
          <Line
            type="monotone"
            dataKey="trainAUC"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
            name="Training AUC"
          />
          <Line
            type="monotone"
            dataKey="valAUC"
            stroke="#8b5cf6"
            strokeWidth={2}
            dot={false}
            name="Validation AUC"
          />
        </LineChart>
      </ResponsiveContainer>

      <div className="mt-4 grid grid-cols-2 gap-4 border-t border-gray-200 pt-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Training AUC</p>
          <p className="text-2xl font-semibold text-blue-600">
            {finalMetrics.trainAUC}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Improvement: +{((finalMetrics.trainAUC - 0.65) * 100).toFixed(1)}%
          </p>
        </div>
        <div className="bg-purple-50 rounded-lg p-4">
          <p className="text-sm text-gray-600 mb-1">Validation AUC</p>
          <p className="text-2xl font-semibold text-purple-600">
            {finalMetrics.valAUC}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Improvement: +{((finalMetrics.valAUC - 0.62) * 100).toFixed(1)}%
          </p>
        </div>
      </div>

      <div className="mt-4 bg-gray-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Model Details</h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-gray-600">Algorithm:</span>
            <span className="ml-2 font-medium text-gray-900">XGBoost</span>
          </div>
          <div>
            <span className="text-gray-600">Total Epochs:</span>
            <span className="ml-2 font-medium text-gray-900">200</span>
          </div>
          <div>
            <span className="text-gray-600">Features:</span>
            <span className="ml-2 font-medium text-gray-900">24 temporal + behavioral</span>
          </div>
          <div>
            <span className="text-gray-600">Dataset:</span>
            <span className="ml-2 font-medium text-gray-900">2.4M events</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MLModelPerformance
