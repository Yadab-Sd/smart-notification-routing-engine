import { useState } from 'react'
import { X } from 'lucide-react'

export default function PilotProgramBanner() {
  const [isVisible, setIsVisible] = useState(true)

  if (!isVisible) return null

  return (
    <div className="bg-blue-600 text-white text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium">
              🎯 Free pilot program for US organizations
            </span>
            <span className="text-blue-200 hidden sm:inline">—</span>
            <a
              href="mailto:contact@intelligent-routing.com?subject=Pilot%20Interest"
              className="hidden sm:inline hover:underline"
            >
              Get started
            </a>
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="p-0.5 rounded hover:bg-white/10"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
