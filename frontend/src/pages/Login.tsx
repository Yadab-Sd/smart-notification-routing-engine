import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/contexts/LanguageContext'
import LoginForm from '@/components/auth/LoginForm'
import LanguageSwitcher from '@/components/common/LanguageSwitcher'
import { Sparkles, BarChart3, Zap, Shield, Clock, TrendingUp } from 'lucide-react'

const Login = () => {
  const { isAuthenticated } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard')
    }
  }, [isAuthenticated, navigate])

  const features = [
    { icon: Clock, title: t('login.feature1.title'), desc: t('login.feature1.desc') },
    { icon: TrendingUp, title: t('login.feature2.title'), desc: t('login.feature2.desc') },
    { icon: Zap, title: t('login.feature3.title'), desc: t('login.feature3.desc') },
    { icon: Shield, title: t('login.feature4.title'), desc: t('login.feature4.desc') },
  ]

  return (
    <div className="min-h-screen grid lg:grid-cols-2 relative">
      {/* Language switcher (toujours visible) */}
      <div className="absolute top-4 right-4 z-50">
        <LanguageSwitcher variant="floating" />
      </div>

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
              <div className="font-bold text-lg">{t('common.appShort')}</div>
              <div className="text-xs text-white/70 uppercase tracking-wider">
                {t('common.appName')}
              </div>
            </div>
          </div>
        </div>

        <div className="relative space-y-8">
          <div>
            <h2 className="text-3xl xl:text-4xl font-bold leading-tight">
              {t('login.heroTitle')}
            </h2>
            <p className="mt-4 text-white/80 max-w-md">{t('login.heroDesc')}</p>
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
            <span>{t('login.eventsPerDay')}</span>
          </div>
          <div className="w-1 h-1 rounded-full bg-white/40" />
          <span>v1.0.0 · 03/06/2026</span>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex items-center justify-center p-6 sm:p-12 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="font-bold text-slate-900">{t('common.appShort')}</div>
          </div>
          <LoginForm />
          <p className="mt-8 text-center text-xs text-slate-400">{t('login.legal')}</p>
        </div>
      </div>
    </div>
  )
}

export default Login
