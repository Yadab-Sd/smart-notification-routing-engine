import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { ENV } from '@/config/env'
import { Mail, Lock, Eye, EyeOff, AlertCircle, Info, Loader2 } from 'lucide-react'

const LoginForm = () => {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      await login({ email, password })
      navigate('/dashboard')
    } catch (err: any) {
      setError(err.message || 'Sign-in failed. Please check your credentials.')
    } finally {
      setIsLoading(false)
    }
  }

  const fillDemo = () => {
    setEmail('demo@snre.io')
    setPassword('demo-password')
  }

  return (
    <div className='border border-white lg:py-20 lg:px-28 rounded-xl'>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Welcome back 👋</h1>
        <p className="text-sm text-slate-500 mt-1">Sign in to manage your notifications.</p>
      </div>

      {ENV.DEMO_MODE && (
        <div className="mb-5 p-3 rounded-lg bg-primary-50 border border-primary-100 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-primary-800 flex-1">
            <div className="font-semibold mb-0.5">Demo mode enabled</div>
            <div>Any email + password combination will work.</div>
            <button
              type="button"
              onClick={fillDemo}
              className="mt-1.5 text-primary-700 underline font-medium hover:text-primary-900"
            >
              Fill with a demo account
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-5 p-3 rounded-lg bg-danger-50 border border-danger-100 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-danger-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-danger-700">{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">Work email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="email"
              id="email"
              className="input pl-10"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="email"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="password" className="label">Password</label>
            <Link to="/forgot-password" className="text-xs text-primary-600 hover:underline">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              className="input pl-10 pr-10"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'hide' : 'show'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-600 select-none">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="rounded border-slate-300 text-primary-600 focus:ring-primary-500"
          />
          Keep me signed in
        </label>

        <button type="submit" className="w-full btn-primary py-3" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in'
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-slate-600">
        Don't have an account?{' '}
        <Link to="/register" className="text-primary-600 hover:underline font-medium">
          Sign up
        </Link>
      </div>

      <div className="mt-6 pt-6 border-t border-slate-100 text-center text-xs text-slate-500">
        Secured by AWS Cognito · TLS 1.3 · JWT 1 h
      </div>
    </div>
  )
}

export default LoginForm
