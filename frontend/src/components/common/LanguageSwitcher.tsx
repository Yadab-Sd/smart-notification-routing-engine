import { useEffect, useRef, useState } from 'react'
import { Languages, Check } from 'lucide-react'
import { useTranslation } from '@/contexts/LanguageContext'
import type { Language } from '@/i18n/translations'

interface Option {
  code: Language
  label: string
  flag: string
}

const options: Option[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
]

interface Props {
  variant?: 'topbar' | 'floating'
}

const LanguageSwitcher = ({ variant = 'topbar' }: Props) => {
  const { language, setLanguage } = useTranslation()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const current = options.find((o) => o.code === language) ?? options[0]

  const triggerClasses =
    variant === 'topbar'
      ? 'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900 text-sm'
      : 'flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/90 backdrop-blur border border-slate-200 shadow-soft text-slate-700 hover:bg-white text-sm'

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={triggerClasses}
        aria-label="Language"
      >
        <Languages size={16} />
        <span className="uppercase font-semibold text-xs">{current.code}</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-elevated border border-slate-100 overflow-hidden animate-fade-in z-50">
          {options.map((opt) => {
            const active = opt.code === language
            return (
              <button
                key={opt.code}
                type="button"
                onClick={() => {
                  setLanguage(opt.code)
                  setOpen(false)
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-slate-50 ${
                  active ? 'text-primary-700 font-semibold' : 'text-slate-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className="text-base">{opt.flag}</span>
                  {opt.label}
                </span>
                {active && <Check size={14} className="text-primary-600" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default LanguageSwitcher
