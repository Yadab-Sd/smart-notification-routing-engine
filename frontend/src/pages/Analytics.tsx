import Layout from '@/components/common/Layout'

const Analytics = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h2>
          <p className="mt-2 text-gray-600">
            ML model performance and engagement metrics
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Events', value: '2.4M' },
            { label: 'Active Users', value: '15,234' },
            { label: 'Avg Engagement', value: '5.8%' },
            { label: 'ML Model AUC', value: '0.78' },
          ].map((metric) => (
            <div key={metric.label} className="card">
              <div className="text-sm text-gray-600">{metric.label}</div>
              <div className="text-3xl font-bold text-primary-600 mt-2">
                {metric.value}
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Engagement Trends</h3>
          <div className="h-64 flex items-center justify-center bg-gray-50 rounded">
            <p className="text-gray-500">Charts coming soon</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">ML Model Performance</h3>
            <div className="h-48 flex items-center justify-center bg-gray-50 rounded">
              <p className="text-gray-500">Training curve coming soon</p>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Send-Time Heatmap</h3>
            <div className="h-48 flex items-center justify-center bg-gray-50 rounded">
              <p className="text-gray-500">Heatmap coming soon</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Analytics
