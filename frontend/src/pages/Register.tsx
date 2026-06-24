import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import PilotProgramBanner from '@/components/common/PilotProgramBanner'
import {
  Sparkles,
  Mail,
  Lock,
  User,
  Building2,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from 'lucide-react'

type Strength = 0 | 1 | 2 | 3 | 4

const evaluateStrength = (pw: string): Strength => {
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Z]/.test(pw)) score++
  if (/[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return Math.min(score, 4) as Strength
}

const STRENGTH_LABELS = ['Weak', 'Weak', 'Medium', 'Strong', 'Very strong']
const STRENGTH_COLORS = [
  'bg-slate-200',
  'bg-danger-500',
  'bg-warning-500',
  'bg-success-500',
  'bg-success-600',
]

const BULLETS = ['Sign up in 60 seconds', 'Self-hosted in your AWS account']

const Register = () => {
  const { signup, isAuthenticated, isLoading: isAuthLoading } = useAuth()
  const navigate = useNavigate()

  const [company, setCompany] = useState('')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const strength = useMemo(() => evaluateStrength(password), [password])

  useEffect(() => {
    if (!isAuthLoading && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [isAuthLoading, isAuthenticated, navigate])

  if (isAuthLoading || isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!acceptTerms) {
      setError('You must accept the terms of service.')
      return
    }
    if (password !== confirm) {
      setError("Passwords don't match.")
      return
    }
    if (strength < 2) {
      setError('Password too weak.')
      return
    }

    setIsLoading(true)
    try {
      await signup({ email, password })
      setSuccess(true)
      setTimeout(() => navigate('/login'), 2200)
    } catch (err: any) {
      setError(err.message || 'Error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      <PilotProgramBanner />
      <div className="min-h-screen grid lg:grid-cols-2">
        {/* Left — branding */}
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
                Join the teams cutting notification fatigue.
              </h2>
              <p className="mt-4 text-white/80 max-w-lg">
                Uses predictive models to send messages via the channel the user
                is most likely to interact with. built to scale to 10M+
                events/day.
              </p>
            </div>

            <ul className="space-y-3 max-w-md">
              {BULLETS.map((b) => (
                <li key={b} className="flex items-center gap-2.5 text-white/90">
                  <span className="w-5 h-5 rounded-full bg-white/15 backdrop-blur flex items-center justify-center">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-sm">{b}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="relative flex items-center gap-2 text-xs text-white/60">
            <ShieldCheck className="w-4 h-4" />
            <span>AWS-native · Customer-operated · Security-conscious</span>
          </div>
        </div>

        {/* Right — form */}
        <div className="flex items-center justify-center p-6 sm:p-10 bg-white overflow-y-auto">
          <div className="w-full max-w-md py-8">
            <div className="lg:hidden flex items-center gap-2.5 mb-8">
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div className="font-bold text-slate-900">SNRE</div>
            </div>

            <div className="mb-8">
              <h1 className="text-2xl font-bold text-slate-900">
                Create your account
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Start optimizing your sends in minutes.
              </p>
            </div>

            {success && (
              <div className="mb-5 p-3 rounded-lg bg-success-50 border border-success-100 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-success-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-success-800">
                  Account created! Check your email to activate your account.
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Company</label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      className="input pl-10"
                      placeholder="Your company name"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      required
                      disabled={isLoading || success}
                    />
                  </div>
                </div>
                <div>
                  <label className="label">Full name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      className="input pl-10"
                      placeholder="First Last"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={isLoading || success}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Work email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    className="input pl-10"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading || success}
                    autoComplete="email"
                  />
                </div>
              </div>

              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-10 pr-10"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={isLoading || success}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2">
                    <div className="grid grid-cols-4 gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-1.5 rounded-full transition-colors ${
                            i < strength
                              ? STRENGTH_COLORS[strength]
                              : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-slate-500">
                        Minimum 8 characters, 1 uppercase, 1 number, 1 special
                        character.
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          strength <= 1
                            ? 'text-danger-600'
                            : strength === 2
                            ? 'text-warning-600'
                            : 'text-success-600'
                        }`}
                      >
                        {STRENGTH_LABELS[strength]}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="label">Confirm password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pl-10"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    disabled={isLoading || success}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <label className="flex items-start gap-2 text-sm text-slate-600 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                  disabled={isLoading || success}
                />
                <span>I accept the terms of service and privacy policy</span>
              </label>

              <button
                type="submit"
                className="w-full btn-primary py-3"
                disabled={isLoading || success}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create my account'
                )}
              </button>
            </form>

            <div className="mt-6 text-center text-sm text-slate-600">
              Already have an account?{' '}
              <Link
                to="/login"
                className="text-primary-600 hover:underline font-medium"
              >
                Sign in
              </Link>
            </div>

            <div className="mt-6 pt-6 border-t border-slate-200 text-center text-sm text-slate-500">
              Need help or demo?{' '}
              <a
                href="mailto:contact@intelligent-routing.com"
                className="text-primary-600 hover:underline font-medium"
              >
                contact@intelligent-routing.com
              </a>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Register
