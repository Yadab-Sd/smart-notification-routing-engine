import { Link } from 'react-router-dom'
import { ArrowLeft, Compass, LayoutDashboard, BarChart3, Sparkles } from 'lucide-react'

const NotFound = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary-50 flex items-center justify-center p-6">
      <div className="card max-w-2xl w-full text-center relative overflow-hidden">
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary-100/60 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-accent-100/60 blur-3xl" />

        <div className="relative">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 mb-6">
            <Compass className="w-7 h-7 text-primary-600" />
          </div>

          <div className="text-7xl sm:text-8xl font-extrabold bg-gradient-to-br from-primary-600 to-primary-900 bg-clip-text text-transparent leading-none">
            404
          </div>

          <h1 className="mt-4 text-2xl font-bold text-slate-900">
            This route was not optimized.
          </h1>
          <p className="mt-2 text-slate-500 max-w-md mx-auto">
            The page you're looking for doesn't exist or has been moved. Let's get you back to your notification flow.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/dashboard" className="btn-primary">
              <LayoutDashboard size={16} /> Go to Dashboard
            </Link>
            <Link to="/analytics" className="btn-secondary">
              <BarChart3 size={16} /> View Analytics
            </Link>
            <button onClick={() => window.history.back()} className="btn-ghost">
              <ArrowLeft size={16} /> Back
            </button>
          </div>

          <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
            <Sparkles size={12} /> Smart Notification Routing Engine · v1.0.0
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotFound
