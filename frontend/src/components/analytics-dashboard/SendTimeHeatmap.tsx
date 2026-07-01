import { useMemo } from 'react'
import { generateHourlyHeatmap } from '@/utils/demo-data'

const SendTimeHeatmap = () => {
  const data = useMemo(() => generateHourlyHeatmap(), [])
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  // Function to get color based on probability
  const getColor = (probability: number) => {
    if (probability >= 0.7) return 'bg-blue-600'
    if (probability >= 0.6) return 'bg-blue-500'
    if (probability >= 0.5) return 'bg-blue-400'
    if (probability >= 0.4) return 'bg-blue-300'
    if (probability >= 0.3) return 'bg-blue-200'
    return 'bg-blue-100'
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Optimal Send Time Heatmap
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Predicted engagement probability by hour and day of week
        </p>
        <div className="flex items-center space-x-6 text-sm">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-100 rounded"></div>
            <span className="text-gray-600">Low (0.1-0.3)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-300 rounded"></div>
            <span className="text-gray-600">Medium (0.3-0.5)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-500 rounded"></div>
            <span className="text-gray-600">High (0.5-0.7)</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 bg-blue-600 rounded"></div>
            <span className="text-gray-600">Very High (0.7+)</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Header - Days of week */}
          <div className="flex">
            <div className="w-16 flex-shrink-0"></div>
            {days.map((day) => (
              <div
                key={day}
                className="flex-1 text-center font-medium text-sm text-gray-700 py-2 min-w-[60px]"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Heatmap grid */}
          {data.map((row) => (
            <div key={row.hour} className="flex">
              {/* Hour label */}
              <div className="w-16 flex-shrink-0 text-xs text-gray-600 flex items-center">
                {row.hour}
              </div>

              {/* Day cells */}
              {days.map((day) => {
                const probability = row[day as keyof typeof row] as number
                return (
                  <div
                    key={`${row.hour}-${day}`}
                    className="flex-1 min-w-[60px] group relative"
                  >
                    <div
                      className={`h-8 m-0.5 rounded ${getColor(probability)} transition-all hover:ring-2 hover:ring-blue-400 cursor-pointer`}
                      title={`${day} ${row.hour}: ${(probability * 100).toFixed(0)}%`}
                    >
                      {/* Tooltip on hover */}
                      <div className="hidden group-hover:block absolute z-10 bg-gray-900 text-white text-xs rounded py-1 px-2 -mt-8 left-1/2 transform -translate-x-1/2 whitespace-nowrap">
                        {(probability * 100).toFixed(0)}%
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-4 border-transparent border-t-gray-900"></div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 bg-blue-50 rounded-lg p-4">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Key Insights</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Peak engagement: Evenings (6 PM - 10 PM) across all days</li>
          <li>• Weekend mornings are a demo pattern; validate with pilot data</li>
          <li>• Lowest engagement: Late night/early morning (12 AM - 6 AM)</li>
          <li>• Weekday work hours (9 AM - 5 PM) show moderate engagement</li>
        </ul>
      </div>
    </div>
  )
}

export default SendTimeHeatmap
