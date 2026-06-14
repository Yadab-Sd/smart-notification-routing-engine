import { useState } from 'react'
import { X, Sparkles, Building2, Mail } from 'lucide-react'

export default function PilotProgramBanner() {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <Sparkles className="w-6 h-6 mt-0.5 flex-shrink-0 animate-pulse" />
            <div className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-lg">
                  Free Pilot Program for US Organizations
                </h3>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-white/20 backdrop-blur-sm">
                  Zero Cost
                </span>
              </div>
              <p className="text-sm text-blue-50 leading-relaxed max-w-4xl">
                <strong>US companies, healthcare providers, educational institutions, and businesses:</strong> We're offering
                complimentary pilot deployments with full technical support at no setup or adoption cost.
                Help us demonstrate the national impact of intelligent notification routing while gaining early access
                to ML-optimized delivery for your transactional messages, alerts, and customer communications.
              </p>
              <div className="flex items-center gap-4 flex-wrap text-sm">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-4 h-4" />
                  <span className="font-medium">Priority: US-based organizations</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Mail className="w-4 h-4" />
                  <a
                    href="mailto:yadab.us2023@gmail.com?subject=Pilot%20Program%20Interest%20-%20Intelligent%20Routing%20Engine"
                    className="underline hover:text-blue-100 transition-colors font-medium"
                  >
                    yadab.us2023@gmail.com
                  </a>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  )
}
