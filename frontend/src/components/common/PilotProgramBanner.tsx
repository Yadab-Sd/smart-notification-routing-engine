import { useState } from 'react'
import {X, Sparkles} from 'lucide-react'

export default function PilotProgramBanner() {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-b border-blue-500/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-center gap-4">
          <div className="flex-1 min-w-0 flex items-center gap-2.5 flex-1 min-w-0 justify-center pr-8">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            <div className="text-sm sm:text-center flex flex-wrap lg:flex-nowrap items-center">
              <span className="font-semibold">
                Deploy SNRE to Your Organization
              </span>
              <div>
              <span className="text-blue-100 px-2 hidden lg:inline-block">•</span>
              <span
                  className="text-blue-100 text-xs lg:text-sm"> Zero-cost deployment with full technical support
 </span>

              </div> <a
                  href="https://get.intelligent-routing.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-bold underline hover:text-white transition-colors lg:ml-2"
              >
                Get Started →
              </a>
            </div>
          </div>
          <button
              onClick={() => setIsVisible(false)}
            className="absolute right-4 flex-shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
            aria-label="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
