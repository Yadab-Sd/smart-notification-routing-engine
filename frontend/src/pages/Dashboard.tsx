import Layout from '@/components/common/Layout'

const Dashboard = () => {
  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold text-gray-900">User Dashboard</h2>
          <p className="mt-2 text-gray-600">
            Schedule notifications and manage your preferences
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Events</span>
                <span className="font-semibold">-</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Clicks</span>
                <span className="font-semibold">-</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Engagement Rate</span>
                <span className="font-semibold">-</span>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-4">Schedule Notification</h3>
            <p className="text-sm text-gray-600 mb-4">
              Coming soon: Schedule your next notification with ML-optimized timing
            </p>
            <button className="btn-primary w-full" disabled>
              Schedule
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
          <p className="text-sm text-gray-600">
            No recent activity
          </p>
        </div>
      </div>
    </Layout>
  )
}

export default Dashboard
