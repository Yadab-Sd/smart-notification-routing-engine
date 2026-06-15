import { ReactNode, useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
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
  Zap,
  Megaphone,
  FileText,
  Users,
  Key,
} from 'lucide-react'

interface LayoutProps {
  children: ReactNode
  title?: string
  subtitle?: string
  actions?: ReactNode
}

const navSections = [
  {
    title: 'Operations',
    items: [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Analytics', href: '/analytics', icon: BarChart3 },
    ],
  },
  {
    title: 'Messaging',
    items: [
      { name: 'Send Event', href: '/events', icon: Zap },
      { name: 'Notifications', href: '/notifications', icon: Send },
      { name: 'Campaigns', href: '/campaigns', icon: Megaphone },
      { name: 'Templates', href: '/templates', icon: FileText },
      { name: 'Users', href: '/users', icon: Users },
      { name: 'Audience', href: '/audience', icon: Users },
    ],
  },
  {
    title: 'Developers',
    items: [
      { name: 'API keys', href: '/api-keys', icon: Key },
    ],
  },
  {
    title: 'Account',
    items: [
      { name: 'Settings', href: '/settings', icon: SettingsIcon },
    ],
  },
]

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': { title: 'Dashboard', subtitle: 'Overview of your notifications and their performance' },
  '/analytics': { title: 'Analytics', subtitle: 'ML performance, engagement and platform health' },
  '/events': { title: 'Send Event', subtitle: 'Send notification events manually for testing' },
  '/notifications': { title: 'Notifications', subtitle: 'All scheduled, in-progress and sent notifications' },
  '/campaigns': { title: 'Campaigns', subtitle: 'Group your notifications by business goal' },
  '/templates': { title: 'Templates', subtitle: 'Reusable templates for your notifications' },
  '/users': { title: 'Users', subtitle: 'Manage user profiles and track creation sources' },
  '/audience': { title: 'Audience', subtitle: 'User segments and targeting' },
  '/api-keys': { title: 'API keys', subtitle: 'API keys and webhooks to integrate SNRE with your stack' },
  '/settings': { title: 'Settings', subtitle: 'User preferences, channels and quiet hours' },
}

const notifItems = [
  { title: 'XGBoost model retrained', desc: 'AUC-PR up to 0.78', ago: '12 min ago', color: 'success' },
  { title: 'Ingestion spike detected', desc: '12k events/sec at 14:32 UTC', ago: '1 h ago', color: 'warning' },
  { title: 'SageMaker endpoint stable', desc: 'p99 = 87 ms (target 100 ms)', ago: '3 h ago', color: 'info' },
]

const Layout = ({ children, title, subtitle, actions }: LayoutProps) => {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const notifRef = useRef<HTMLDivElement>(null)

  const meta = pageMeta[location.pathname]
  const resolvedTitle = title ?? (meta ? meta.title : 'SNRE')
  const resolvedSubtitle = subtitle ?? (meta ? meta.subtitle : '')

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

  const Sidebar = (
    <aside className="flex flex-col h-full w-64 bg-white border-r border-slate-200">
      <div className="px-5 py-5 border-b border-slate-100 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-soft">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="leading-tight">
            <div className="font-bold text-slate-900">SNRE</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-400">Routing Engine</div>
          </div>
        </Link>
        <button
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden text-slate-500 hover:text-slate-900"
          aria-label="Close"
        >
          <X size={20} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5 space-y-6">
        {navSections.map((section) => (
          <div key={section.title}>
            <div className="sidebar-section-title">{section.title}</div>
            <div className="space-y-1">
              {section.items.map((item) => (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`sidebar-link ${isActive(item.href) ? 'sidebar-link-active' : ''}`}
                >
                  <item.icon size={18} />
                  <span>{item.name}</span>
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
          <span>Help &amp; Documentation</span>
        </a>
      </div>

      <div className="px-3 py-3 border-t border-slate-100">
        <div className="flex items-center gap-3 px-2 py-2 rounded-lg">
          <div className="w-9 h-9 rounded-full bg-primary-600 text-white text-sm font-semibold flex items-center justify-center">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-slate-900 truncate">
              {user?.email || 'User'}
            </div>
            <div className="text-xs text-slate-500">Admin</div>
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
                placeholder="Search user, notification..."
                className="bg-transparent outline-none text-sm w-full placeholder:text-slate-400"
              />
              <kbd className="hidden md:inline text-[10px] font-medium text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 bg-white">
                ⌘K
              </kbd>
            </div>

            <div className="flex-1" />

            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-success-50 text-success-700 text-xs font-medium">
              <span className="status-dot bg-success-500 animate-pulse-dot" />
              <span>All services OK</span>
            </div>

            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                aria-label="Notifications"
              >
                <Bell size={18} />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-danger-500 rounded-full ring-2 ring-white" />
              </button>
              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-elevated border border-slate-100 overflow-hidden animate-fade-in">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-900">Notifications</span>
                    <span className="badge badge-info">3 new</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifItems.map((n, i) => (
                      <div key={i} className="px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0">
                        <div className="flex items-start gap-3">
                          <span className={`status-dot mt-1.5 bg-${n.color === 'info' ? 'primary' : n.color}-500`} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900">{n.title}</div>
                            <div className="text-xs text-slate-500">{n.desc}</div>
                            <div className="text-xs text-slate-400 mt-0.5">{n.ago}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-slate-100 text-center">
                    <button className="text-xs text-primary-600 hover:underline font-medium">
                      View all notifications
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
                    <div className="text-xs text-slate-500">Administrator</div>
                  </div>
                  <div className="py-1">
                    <Link to="/settings" className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                      <SettingsIcon size={16} /> Settings
                    </Link>
                    <button
                      onClick={logout}
                      className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger-600 hover:bg-danger-50"
                    >
                      <LogOut size={16} /> Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-4 sm:px-6 lg:px-8 pb-5 pt-1 flex flex-wrap items-end justify-between gap-3">
            <div>
              <div className="text-xs text-slate-400 mb-1">
                SNRE / <span className="text-slate-600">{resolvedTitle}</span>
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
          <span>© {new Date().getFullYear()} Smart Notification Routing Engine — v1.0.0</span>
          <span>
            Region: {import.meta.env.VITE_REGION || 'us-west-2'} · Status: operational
          </span>
        </footer>
      </div>
    </div>
  )
}

export default Layout
