import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import LoginForm from '@/components/auth/LoginForm'
import { Sparkles, BarChart3, Zap, Shield, Clock, TrendingUp } from 'lucide-react'

const features = [
  { icon: Clock, title: 'Optimal timing', desc: 'XGBoost predicts the send time that maximizes click rate.' },
  { icon: TrendingUp, title: '+40 to 60% engagement', desc: 'vs uniform sending, measured on a 48-hour rolling window.' },
  { icon: Zap, title: 'Inference < 100 ms p99', desc: 'Real-time SageMaker endpoint, scalable to 5,000 req/s.' },
  { icon: Shield, title: 'Cognito + JWT', desc: 'Secure auth, 1 h tokens, isolated VPC.' },
]

const Login = () => {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left panel — branding */}
      <div className="hidden lg:flex relative flex-col justify-between p-12 bg-gradient-to-br from-primary-700 via-primary-600 to-primary-900 text-white overflow-hidden">
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-400/30 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-accent-500/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="font-bold text-lg">SNRE</div>
              <div className="text-xs text-white/70 uppercase tracking-wider">
                Smart Notification Routing Engine
              </div>
            </div>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <h2 className="text-3xl xl:text-4xl font-bold leading-tight">
              Drive your notifications with Machine Learning.
            </h2>
            <p className="mt-4 text-white/80 max-w-md">
              A serverless platform that picks the right moment and the right channel for every user — and cuts notification fatigue.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-xl">
            {features.map((f) => (
              <div
                key={f.title}
                className="p-4 rounded-xl bg-white/10 backdrop-blur border border-white/10"
              >
                <f.icon className="w-5 h-5 mb-2 text-accent-100" />
                <div className="font-semibold text-sm">{f.title}</div>
                <div className="text-xs text-white/70 mt-1">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative flex items-center gap-6 text-xs text-white/60">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            <span>10M+ events/day</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-white/40" />
          <span>v1.0.0 · 06/03/2026</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="font-bold text-slate-900">SNRE</div>
          </div>
          <LoginForm />
          <p className="mt-8 text-center text-xs text-slate-400">
            By signing in, you accept the terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
