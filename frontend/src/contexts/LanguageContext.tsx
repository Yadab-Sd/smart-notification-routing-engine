import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { translations, type Language, type TranslationKey } from '@/i18n/translations'

interface LanguageContextValue {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined)

const STORAGE_KEY = 'snre_language'

const detectInitialLanguage = (): Language => {
  if (typeof window === 'undefined') return 'fr'
  const stored = localStorage.getItem(STORAGE_KEY) as Language | null
  if (stored === 'fr' || stored === 'en') return stored
  const browser = navigator.language?.toLowerCase() || ''
  return browser.startsWith('en') ? 'en' : 'fr'
}

const interpolate = (str: string, vars?: Record<string, string | number>) => {
  if (!vars) return str
  return str.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`))
}

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(detectInitialLanguage)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, language)
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang)
  }, [])

  const t = useCallback(
    (key: TranslationKey, vars?: Record<string, string | number>) => {
      const dict = translations[language] as Record<string, string>
      const fallback = translations.fr as Record<string, string>
      const raw = dict[key] ?? fallback[key] ?? key
      return interpolate(raw, vars)
    },
    [language]
  )

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useTranslation = () => {
  const ctx = useContext(LanguageContext)
  if (!ctx) {
    throw new Error('useTranslation must be used within a LanguageProvider')
  }
  return ctx
}
