import { useState } from 'react'
import { Calculator, DollarSign, TrendingUp, Zap } from 'lucide-react'

const ImpactCalculator = () => {
  const [userBase, setUserBase] = useState(100000)
  const [notificationsPerUser, setNotificationsPerUser] = useState(10)
  const [baselineEngagement, setBaselineEngagement] = useState(3.5)
  const [mlEngagement, setMlEngagement] = useState(5.8)
  const [revenuePerEngagement, setRevenuePerEngagement] = useState(2.5)

  // Calculations
  const totalNotifications = userBase * notificationsPerUser
  const baselineEngagements = Math.floor((totalNotifications * baselineEngagement) / 100)
  const mlEngagements = Math.floor((totalNotifications * mlEngagement) / 100)
  const additionalEngagements = mlEngagements - baselineEngagements
  const improvementPercentage = (((mlEngagement - baselineEngagement) / baselineEngagement) * 100).toFixed(1)

  const baselineRevenue = baselineEngagements * revenuePerEngagement
  const mlRevenue = mlEngagements * revenuePerEngagement
  const additionalRevenue = mlRevenue - baselineRevenue

  // Environmental impact (rough estimates)
  const energySavedKwh = Math.floor(additionalEngagements * 0.0001) // 0.0001 kWh per prevented notification
  const co2SavedKg = Math.floor(energySavedKwh * 0.5) // 0.5 kg CO2 per kWh

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`
    return num.toLocaleString()
  }

  const formatCurrency = (num: number) => {
    if (num >= 1000000) return `$${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `$${(num / 1000).toFixed(1)}K`
    return `$${num.toFixed(2)}`
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="mb-6">
        <div className="flex items-center space-x-2 mb-2">
          <Calculator className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Business Impact Calculator
          </h3>
        </div>
        <p className="text-sm text-gray-600">
          Adjust parameters to calculate the business and environmental impact of ML-optimized send times
        </p>
      </div>

      {/* Input Controls */}
      <div className="space-y-6 mb-8">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">User Base Size</label>
            <span className="text-sm font-semibold text-blue-600">{formatNumber(userBase)} users</span>
          </div>
          <input
            type="range"
            min="10000"
            max="10000000"
            step="10000"
            value={userBase}
            onChange={(e) => setUserBase(Number(e.target.value))}
            className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>10K</span>
            <span>10M</span>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">Notifications per User (Monthly)</label>
            <span className="text-sm font-semibold text-blue-600">{notificationsPerUser}</span>
          </div>
          <input
            type="range"
            min="1"
            max="100"
            step="1"
            value={notificationsPerUser}
            onChange={(e) => setNotificationsPerUser(Number(e.target.value))}
            className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>1</span>
            <span>100</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">Baseline Engagement</label>
              <span className="text-sm font-semibold text-gray-600">{baselineEngagement}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="10"
              step="0.1"
              value={baselineEngagement}
              onChange={(e) => setBaselineEngagement(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-gray-600"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-medium text-gray-700">ML-Optimized</label>
              <span className="text-sm font-semibold text-blue-600">{mlEngagement}%</span>
            </div>
            <input
              type="range"
              min="1"
              max="15"
              step="0.1"
              value={mlEngagement}
              onChange={(e) => setMlEngagement(Number(e.target.value))}
              className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-medium text-gray-700">Revenue per Engagement</label>
            <span className="text-sm font-semibold text-green-600">${revenuePerEngagement}</span>
          </div>
          <input
            type="range"
            min="0.1"
            max="50"
            step="0.1"
            value={revenuePerEngagement}
            onChange={(e) => setRevenuePerEngagement(Number(e.target.value))}
            className="w-full h-2 bg-green-100 rounded-lg appearance-none cursor-pointer accent-green-600"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>$0.10</span>
            <span>$50</span>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4">
        {/* Improvement Summary */}
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <TrendingUp className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Engagement Improvement</p>
                <p className="text-3xl font-bold text-blue-600">+{improvementPercentage}%</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Additional Engagements</p>
              <p className="text-2xl font-bold text-gray-900">{formatNumber(additionalEngagements)}</p>
            </div>
          </div>
        </div>

        {/* Revenue Impact */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DollarSign className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Monthly Revenue Impact</p>
                <p className="text-3xl font-bold text-green-600">{formatCurrency(additionalRevenue)}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Baseline: {formatCurrency(baselineRevenue)}</p>
              <p className="text-xs text-gray-500">ML-Optimized: {formatCurrency(mlRevenue)}</p>
              <p className="text-sm font-medium text-green-600 mt-1">Annual: {formatCurrency(additionalRevenue * 12)}</p>
            </div>
          </div>
        </div>

        {/* Environmental Impact */}
        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-lg p-4 border border-emerald-200">
          <div className="flex items-center space-x-3 mb-3">
            <Zap className="w-6 h-6 text-emerald-600" />
            <p className="text-sm font-medium text-gray-900">Environmental Impact</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="bg-white rounded p-3">
              <p className="text-gray-600 mb-1">Energy Saved</p>
              <p className="text-lg font-bold text-emerald-600">{formatNumber(energySavedKwh)} kWh</p>
            </div>
            <div className="bg-white rounded p-3">
              <p className="text-gray-600 mb-1">CO₂ Reduced</p>
              <p className="text-lg font-bold text-emerald-600">{formatNumber(co2SavedKg)} kg</p>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Total Notifications</p>
            <p className="text-lg font-semibold text-gray-900">{formatNumber(totalNotifications)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">ML Engagements</p>
            <p className="text-lg font-semibold text-blue-600">{formatNumber(mlEngagements)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-500 mb-1">Cost per User</p>
            <p className="text-lg font-semibold text-gray-900">${((additionalRevenue / userBase) || 0).toFixed(2)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ImpactCalculator
