import { ReactNode, useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useTranslation } from '@/contexts/LanguageContext'
import LanguageSwitcher from './LanguageSwitcher'
import {
  BarChart3,
  LayoutDashboard,
  LogOut,
  Settings as SettingsIcon,
  Bell,
  Search,
  ChevronDown,
  Sparkles,
  Menu,
  X,
  HelpCircle,
  Send,
  Megaphone,
  FileText,
  Users,
  Key,
} from 'lucide-react'
import type { TranslationKey } from '@/i18n/translations'

interface LayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
}

const Layout = ({ children, title, subtitle, actions }: LayoutProps) => {
  const { user, logout } = useAuth()
  const { t, language } = useTranslation()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const navSections = [
    {
      titleKey: 'nav.section.pilotage' as TranslationKey,
      items: [
        { nameKey: 'nav.dashboard' as TranslationKey, href: '/dashboard', icon: LayoutDashboard },
        { nameKey: 'nav.analytics' as TranslationKey, href: '/analytics', icon: BarChart3 },
      ],
    },
    {
      titleKey: 'nav.section.operations' as TranslationKey,
      items: [
        { nameKey: 'nav.notifications' as TranslationKey, href: '/notifications', icon: Send },
        { nameKey: 'nav.campaigns' as TranslationKey, href: '/campaigns', icon: Megaphone },
        { nameKey: 'nav.templates' as TranslationKey, href: '/templates', icon: FileText },
        { nameKey: 'nav.audience' as TranslationKey, href: '/audience', icon: Users },
      ],
    },
    {
      titleKey: 'nav.section.developers' as TranslationKey,
      items: [
        { nameKey: 'nav.apiKeys' as TranslationKey, href: '/api-keys', icon: Key },
      ],
    },
    {
      titleKey: 'nav.section.account' as TranslationKey,
      items: [
        { nameKey: 'nav.settings' as TranslationKey, href: '/settings', icon: SettingsIcon },
      ],
    },
  ]

  const pageMeta: Record<string, { titleKey: TranslationKey; subtitleKey: TranslationKey }> = {
    '/dashboard': { titleKey: 'nav.dashboard', subtitleKey: 'page.dashboard.subtitle' },
    '/analytics': { titleKey: 'nav.analytics', subtitleKey: 'page.analytics.subtitle' },
    '/notifications': { titleKey: 'nav.notifications', subtitleKey: 'page.notifications.subtitle' },
    '/campaigns': { titleKey: 'nav.campaigns', subtitleKey: 'page.campaigns.subtitle' },
    '/templates': { titleKey: 'nav.templates', subtitleKey: 'page.templates.subtitle' },
    '/audience': { titleKey: 'nav.audience', subtitleKey: 'page.audience.subtitle' },
    '/api-keys': { titleKey: 'nav.apiKeys', subtitleKey: 'page.apiKeys.subtitle' },
    '/settings': { titleKey: 'nav.settings', subtitleKey: 'page.settings.subtitle' },
  }

  const meta = pageMeta[location.pathname]
  const resolvedTitle = title ?? (meta ? t(meta.titleKey) : 'SNRE')
  const resolvedSubtitle = subtitle ?? (meta ? t(meta.subtitleKey) : '')

  const isActive = (path: string) => location.pathname === path
  const initials = (user?.email || 'U').slice(0, 2).toUpperCase()

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const notifItems = [
    { titleKey: 'notif.item1.title' as TranslationKey, descKey: 'notif.item1.desc' as TranslationKey, ago: t('notif.timeAgoMin', { n: 12 }), color: 'success' },
    { titleKey: 'notif.item2.title' as TranslationKey, descKey: 'notif.item2.desc' as TranslationKey, ago: t('notif.timeAgoHour', { n: 1 }), color: 'warning' },
    { titleKey: 'notif.item3.title' as TranslationKey, descKey: 'notif.item3.desc' as TranslationKey, ago: t('notif.timeAgoHour', { n: 3 }), color: 'info' },
  ]

  const Sidebar = (
    <aside className="flex flex-col h-full w-64 bg-white border-r border-slate-200">
      <div className="px-5 py-5 border-b border-slate-100 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-soft">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-slate-900">{t('common.appShort')}</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">
              {t('common.tagline')}
            </div>
          </div>
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-slate-500 hover:text-slate-900"
          aria-label={t('common.close')}
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {navSections.map((section) => (
          <div key={section.titleKey}>
            <div className="sidebar-section-title">{t(section.titleKey)}</div>
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link
                  key={item.nameKey}
                  to={item.href}
                  className={`sidebar-link ${isActive(item.href) ? 'sidebar-link-active' : ''}`}
                >
                  <item.icon size={18} />
                  <span>{t(item.nameKey)}</span>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="px-3 py-3 border-t border-slate-100">
        <a
          href="https://github.com/Yadab-Sd/smart-notification-routing-engine"
          target="_blank"
          rel="noreferrer"
          className="sidebar-link"
        >
          <HelpCircle size={18} />
          <span>{t('nav.help')}</span>
        </a>
      </div>

      <div className="px-3 py-3 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-9 h-9 rounded-full bg-primary-600 text-white text-sm font-semibold flex items-center justify-center">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-900 truncate">
              {user?.email || t('common.user')}
            </div>
            <div className="text-xs text-slate-500">{t('common.admin')}</div>
          </div>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="hidden lg:flex fixed inset-y-0 left-0 z-30">{Sidebar}</div>

      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-slate-900/40" onClick={() => setSidebarOpen(false)} />
          <div className="relative z-50">{Sidebar}</div>
        </div>
      )}

      <div className="lg:pl-64 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-slate-200">
          <div className="flex items-center gap-3 px-4 sm:px-6 lg:px-8 h-16">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden text-slate-600 hover:text-slate-900"
              aria-label="Menu"
            >
              <Menu size={22} />
            </button>

            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 border border-transparent focus-within:bg-white focus-within:border-slate-200 transition-colors w-72">
              <Search size={16} className="text-slate-400" />
              <input
                type="text"
                placeholder={t('common.search')}
                className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400"
              />
              <kbd className="hidden md:inline text-[10px] font-medium text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 bg-white">
                ⌘K
              </kbd>
            </div>

            <div className="flex-1" />

            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-success-50 text-success-700 text-xs font-medium">
              <span className="status-dot bg-success-500 animate-pulse-dot" />
              <span>{t('common.allServicesOk')}</span>
            </div>

            <LanguageSwitcher />

            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                aria-label={t('notif.title')}
              >
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full ring-2 ring-white" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-elevated border border-slate-100 overflow-hidden animate-fade-in">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{t('notif.title')}</span>
                    <span className="badge badge-info">{t('notif.newCount', { count: 3 })}</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifItems.map((n, i) => (
                      <div key={i} className="px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0">
                        <div className="flex items-start gap-3">
                          <span className={`status-dot mt-1.5 bg-${n.color === 'info' ? 'primary' : n.color}-500`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900">{t(n.titleKey)}</div>
                            <div className="text-xs text-slate-500">{t(n.descKey)}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{n.ago}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-slate-100 text-center">
                    <button className="text-xs text-primary-600 hover:underline font-medium">
                      {t('notif.viewAll')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-lg hover:bg-slate-100"
              >
                <div className="w-8 h-8 rounded-full bg-primary-600 text-white text-xs font-semibold flex items-center justify-center">
                  {initials}
                </div>
                <ChevronDown size={16} className="text-slate-500" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-elevated border border-slate-100 overflow-hidden animate-fade-in">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <div className="text-sm font-medium text-slate-900 truncate">{user?.email}</div>
                    <div className="text-xs text-slate-500">{t('common.administrator')}</div>
                  </div>
                  <div className="py-1">
                    <Link to="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <SettingsIcon size={16} /> {t('nav.settings')}
                    </Link>
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
                    >
                      <LogOut size={16} /> {t('nav.logout')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 sm:px-6 lg:px-8 pb-5 pt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400 mb-1">
                {t('common.appShort')} / <span className="text-slate-600">{resolvedTitle}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900">{resolvedTitle}</h1>
              {resolvedSubtitle && (
                <p className="text-sm text-slate-500 mt-1">{resolvedSubtitle}</p>
              )}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 animate-fade-in">{children}</main>

        <footer className="px-4 sm:px-6 lg:px-8 py-4 text-xs text-slate-400 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <span>{t('footer.copyright', { year: new Date().getFullYear() })}</span>
          <span>
            {t('common.region')} : {import.meta.env.VITE_REGION || 'us-west-2'} · {t('common.statusOperational')} · {language.toUpperCase()}
          </span>
        </footer>
      </div>
    </div>
  )
}

export default Layout
