import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Sparkles, Mail, ArrowLeft, CheckCircle2, Loader2, KeyRound } from 'lucide-react'

const ForgotPassword = () => {
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setSent(true)
    }, 700)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-primary-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft size={14} />
          Back to sign in
        </Link>

        <div className="card relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-primary-100/60 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-soft">
                {sent ? <CheckCircle2 className="w-5 h-5 text-white" /> : <KeyRound className="w-5 h-5 text-white" />}
              </div>
              <div className="font-bold text-slate-900">SNRE</div>
            </div>

            {!sent ? (
              <>
                <h1 className="text-2xl font-bold text-slate-900">Forgot password?</h1>
                <p className="text-sm text-slate-500 mt-1 mb-6">
                  Enter your email and we'll send you a reset link.
                </p>

                <form onSubmit={handleSubmit} className="space-y-4">
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
                        disabled={isLoading}
                        autoFocus
                      />
                    </div>
                  </div>

                  <button type="submit" className="w-full btn-primary py-3" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Sending...
                      </>
                    ) : (
                      'Send link'
                    )}
                  </button>
                </form>
              </>
            ) : (
              <div className="text-center py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-success-100 mb-4">
                  <CheckCircle2 className="w-7 h-7 text-success-600" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">Link sent ✉️</h1>
                <p className="text-sm text-slate-500 mt-2 max-w-xs mx-auto">
                  If an account exists for this email, you'll receive a reset link in a few minutes.
                </p>
                <div className="mt-6 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setSent(false)}
                    className="btn-secondary text-sm"
                  >
                    Resend
                  </button>
                  <Link to="/login" className="btn-primary text-sm">
                    Back to sign in
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-400 flex items-center justify-center gap-1.5">
          <Sparkles className="w-3 h-3" />
          Smart Notification Routing Engine
        </p>
      </div>
    </div>
  )
}

export default ForgotPassword
