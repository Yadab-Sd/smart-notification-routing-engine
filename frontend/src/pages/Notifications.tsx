import { useMemo, useState } from 'react'
import Layout from '@/components/common/Layout'
import { useTranslation } from '@/contexts/LanguageContext'
import type { TranslationKey } from '@/i18n/translations'
import {
  Plus,
  Search,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Send,
  Clock,
  CheckCircle2,
  XCircle,
  Download,
  MoreHorizontal,
  Trash2,
  Copy,
  Pencil,
} from 'lucide-react'

type Channel = 'Email' | 'SMS' | 'Push' | 'WhatsApp'
type StatusKey = 'sent' | 'scheduled' | 'failed' | 'inProgress'

interface Row {
  id: string
  titleKey: TranslationKey
  channel: Channel
  audience: string
  recipients: number
  statusKey: StatusKey
  sentAt: string
  ctr: number
}

const channelIcon = (c: Channel) => {
  if (c === 'Email') return Mail
  if (c === 'SMS') return MessageSquare
  if (c === 'Push') return Bell
  return Smartphone
}

const statusBadge = (s: StatusKey) => {
  if (s === 'sent') return 'badge badge-success'
  if (s === 'scheduled') return 'badge badge-info'
  if (s === 'inProgress') return 'badge badge-warning'
  return 'badge badge-danger'
}

const ROWS: Row[] = [
  { id: 'N-9412', titleKey: 'dash.notif1.title', channel: 'Email', audience: 'EU customers', recipients: 12_430, statusKey: 'sent', sentAt: '2026-06-06 19:30', ctr: 6.2 },
  { id: 'N-9411', titleKey: 'dash.notif2.title', channel: 'SMS', audience: 'Order #98231', recipients: 1, statusKey: 'sent', sentAt: '2026-06-06 10:15', ctr: 14.8 },
  { id: 'N-9410', titleKey: 'dash.notif3.title', channel: 'Push', audience: 'Active mobile users', recipients: 48_902, statusKey: 'inProgress', sentAt: '2026-06-06 20:00', ctr: 5.4 },
  { id: 'N-9409', titleKey: 'dash.notif4.title', channel: 'Email', audience: 'Cart abandoners', recipients: 3_817, statusKey: 'scheduled', sentAt: '2026-06-07 09:45', ctr: 0 },
  { id: 'N-9408', titleKey: 'dash.notif5.title', channel: 'SMS', audience: 'Single user', recipients: 1, statusKey: 'failed', sentAt: '2026-06-06 14:02', ctr: 0 },
  { id: 'N-9407', titleKey: 'dash.notif6.title', channel: 'Email', audience: 'All subscribers', recipients: 65_201, statusKey: 'sent', sentAt: '2026-06-05 18:45', ctr: 4.1 },
  { id: 'N-9406', titleKey: 'dash.notif1.title', channel: 'Push', audience: 'Power users', recipients: 8_902, statusKey: 'sent', sentAt: '2026-06-05 12:30', ctr: 7.9 },
  { id: 'N-9405', titleKey: 'dash.notif3.title', channel: 'Email', audience: 'New cohort', recipients: 2_104, statusKey: 'sent', sentAt: '2026-06-04 09:00', ctr: 8.5 },
]

const Notifications = () => {
  const { t, language } = useTranslation()
  const [tab, setTab] = useState<'all' | StatusKey>('all')
  const [channelFilter, setChannelFilter] = useState<Channel | 'all'>('all')
  const [search, setSearch] = useState('')
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return ROWS.filter((r) => {
      if (tab !== 'all' && r.statusKey !== tab) return false
      if (channelFilter !== 'all' && r.channel !== channelFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (
          !r.id.toLowerCase().includes(q) &&
          !t(r.titleKey).toLowerCase().includes(q) &&
          !r.audience.toLowerCase().includes(q)
        )
          return false
      }
      return true
    })
  }, [tab, channelFilter, search, t])

  const kpis = [
    { titleKey: 'notifs.kpi.total' as TranslationKey, value: '186 432', icon: Send, color: 'bg-primary-100', text: 'text-primary-700' },
    { titleKey: 'notifs.kpi.scheduled' as TranslationKey, value: '1 247', icon: Clock, color: 'bg-warning-100', text: 'text-warning-700' },
    { titleKey: 'notifs.kpi.delivered' as TranslationKey, value: '99.4 %', icon: CheckCircle2, color: 'bg-success-100', text: 'text-success-700' },
    { titleKey: 'notifs.kpi.failed' as TranslationKey, value: '0.6 %', icon: XCircle, color: 'bg-danger-100', text: 'text-danger-700' },
  ]

  const tabs: { key: 'all' | StatusKey; labelKey: TranslationKey; count?: number }[] = [
    { key: 'all', labelKey: 'notifs.tab.all', count: ROWS.length },
    { key: 'scheduled', labelKey: 'notifs.tab.scheduled', count: ROWS.filter((r) => r.statusKey === 'scheduled').length },
    { key: 'sent', labelKey: 'notifs.tab.sent', count: ROWS.filter((r) => r.statusKey === 'sent').length },
    { key: 'failed', labelKey: 'notifs.tab.failed', count: ROWS.filter((r) => r.statusKey === 'failed').length },
  ]

  const statusText = (s: StatusKey) => {
    const map: Record<StatusKey, TranslationKey> = {
      sent: 'dash.status.sent',
      scheduled: 'dash.status.scheduled',
      failed: 'dash.status.failed',
      inProgress: 'dash.status.inProgress',
    }
    return t(map[s])
  }

  return (
    <Layout
      actions={
        <>
          <button className="btn-secondary">
            <Download size={16} /> {t('common.export')}
          </button>
          <button className="btn-primary">
            <Plus size={16} /> {t('dash.newNotification')}
          </button>
        </>
      }
    >
      <div className="space-y-6" onClick={() => setMenuOpenId(null)}>
        {/* KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((k) => (
            <div key={k.titleKey} className="stat-card">
              <div className={`stat-icon-wrap ${k.color}`}>
                <k.icon size={18} className={k.text} />
              </div>
              <div>
                <div className="text-xs text-slate-500">{t(k.titleKey)}</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{k.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters bar */}
        <div className="card-flush p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 border border-slate-200">
            {tabs.map((tb) => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                  tab === tb.key ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t(tb.labelKey)}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === tb.key ? 'bg-primary-100 text-primary-700' : 'bg-slate-200 text-slate-600'}`}>
                  {tb.count}
                </span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                className="input pl-9"
                placeholder={t('notifs.searchPlaceholder')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select
              className="select w-36"
              value={channelFilter}
              onChange={(e) => setChannelFilter(e.target.value as Channel | 'all')}
            >
              <option value="all">{t('notifs.filterAll')} ({t('notifs.filterChannel').toLowerCase()})</option>
              <option>Email</option>
              <option>SMS</option>
              <option>Push</option>
              <option>WhatsApp</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="card-flush">
          <div className="overflow-x-auto">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">{t('notifs.empty')}</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('dash.table.id')}</th>
                    <th>{t('dash.table.title')}</th>
                    <th>{t('dash.table.channel')}</th>
                    <th>Audience</th>
                    <th>{t('dash.table.recipients')}</th>
                    <th>{t('dash.table.optimalTime')}</th>
                    <th>{t('dash.table.ctr')}</th>
                    <th>{t('dash.table.status')}</th>
                    <th className="text-right pr-6">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => {
                    const Icon = channelIcon(r.channel)
                    return (
                      <tr key={r.id}>
                        <td className="font-mono text-xs text-slate-500">{r.id}</td>
                        <td className="font-medium text-slate-900">{t(r.titleKey)}</td>
                        <td>
                          <span className="inline-flex items-center gap-1.5 text-slate-700">
                            <Icon size={14} className="text-slate-400" />
                            {r.channel}
                          </span>
                        </td>
                        <td className="text-slate-600">{r.audience}</td>
                        <td>{r.recipients.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}</td>
                        <td className="text-slate-500 text-xs">{r.sentAt}</td>
                        <td>
                          {r.ctr > 0 ? (
                            <span className="font-medium text-slate-900">{r.ctr} %</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td>
                          <span className={statusBadge(r.statusKey)}>{statusText(r.statusKey)}</span>
                        </td>
                        <td className="text-right pr-6 relative" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => setMenuOpenId(menuOpenId === r.id ? null : r.id)}
                            className="p-1 rounded hover:bg-slate-100 text-slate-500"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                          {menuOpenId === r.id && (
                            <div className="absolute right-4 top-10 z-10 w-44 bg-white rounded-lg shadow-elevated border border-slate-100 overflow-hidden animate-fade-in">
                              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                <Pencil size={14} /> {t('common.edit')}
                              </button>
                              <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                <Copy size={14} /> {t('common.duplicate')}
                              </button>
                              <button
                                onClick={() => {
                                  if (confirm(t('notifs.delete.confirm'))) setMenuOpenId(null)
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger-600 hover:bg-danger-50"
                              >
                                <Trash2 size={14} /> {t('common.delete')}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {filtered.length > 0 && (
            <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span>
                {filtered.length} {t('common.results')}
              </span>
              <div className="flex items-center gap-2">
                <button className="btn-ghost text-xs">{t('common.previous')}</button>
                <span>{t('common.page')} 1 {t('common.of')} 1</span>
                <button className="btn-ghost text-xs">{t('common.next')}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default Notifications
