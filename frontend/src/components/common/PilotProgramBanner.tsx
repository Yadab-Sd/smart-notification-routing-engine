import { useState } from 'react'
import { X, Sparkles, Building2, Mail } from 'lucide-react'

export default function PilotProgramBanner() {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-b border-blue-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-1 min-w-0">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <div className="flex items-center gap-2 flex-wrap text-sm">
              <span className="font-semibold">
                Free Pilot for US Organizations
              </span>
              <span className="text-blue-100">•</span>
              <span className="text-blue-100">
                Zero-cost deployment with full technical support
              </span>
              <span className="hidden sm:inline text-blue-100">•</span>
              <a
                href="mailto:contact@intelligent-routing.com?subject=Pilot%20Deployment%20Interest"
                className="hidden sm:inline-flex items-center gap-1.5 hover:text-blue-100 transition-colors underline underline-offset-2"
              >
                <Mail className="w-3.5 h-3.5" />
                <span>contact@intelligent-routing.com</span>
              </a>
            </div>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
