import Layout from '@/components/common/Layout'
import { useTranslation } from '@/contexts/LanguageContext'
import type { TranslationKey } from '@/i18n/translations'
import {
  Megaphone,
  Users,
  TrendingUp,
  Activity,
  Plus,
  Play,
  Pause,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Sparkles,
} from 'lucide-react'

type CampStatus = 'active' | 'paused' | 'ended' | 'draft'
type Channel = 'Email' | 'SMS' | 'Push' | 'WhatsApp'

interface Campaign {
  id: string
  nameKey: TranslationKey
  status: CampStatus
  audience: string
  channels: Channel[]
  sent: number
  ctr: number
  uplift: number
}

const channelIcon = (c: Channel) => {
  if (c === 'Email') return Mail
  if (c === 'SMS') return MessageSquare
  if (c === 'Push') return Bell
  return Smartphone
}

const statusClass = (s: CampStatus) => {
  if (s === 'active') return 'badge badge-success'
  if (s === 'paused') return 'badge badge-warning'
  if (s === 'ended') return 'badge badge-neutral'
  return 'badge badge-info'
}

const CAMPAIGNS: Campaign[] = [
  { id: 'C-01', nameKey: 'camp.demo1', status: 'active', audience: 'New cohort (30d)', channels: ['Email', 'Push'], sent: 12_430, ctr: 7.4, uplift: 58 },
  { id: 'C-02', nameKey: 'camp.demo2', status: 'active', audience: 'Inactive 30+ days', channels: ['Email', 'SMS'], sent: 28_902, ctr: 4.1, uplift: 42 },
  { id: 'C-03', nameKey: 'camp.demo3', status: 'paused', audience: 'EU customers', channels: ['Email', 'Push', 'SMS'], sent: 154_210, ctr: 9.8, uplift: 72 },
  { id: 'C-04', nameKey: 'camp.demo4', status: 'active', audience: 'Power users (top 10%)', channels: ['Push'], sent: 4_817, ctr: 12.3, uplift: 38 },
  { id: 'C-05', nameKey: 'camp.demo5', status: 'ended', audience: 'All subscribers', channels: ['Email'], sent: 65_201, ctr: 5.9, uplift: 27 },
  { id: 'C-06', nameKey: 'camp.demo6', status: 'draft', audience: 'Birthday segment', channels: ['Email', 'SMS', 'WhatsApp'], sent: 0, ctr: 0, uplift: 0 },
]

const Campaigns = () => {
  const { t, language } = useTranslation()
  const activeCount = CAMPAIGNS.filter((c) => c.status === 'active').length

  const statusText = (s: CampStatus) => {
    const map: Record<CampStatus, TranslationKey> = {
      active: 'camp.status.active',
      paused: 'camp.status.paused',
      ended: 'camp.status.ended',
      draft: 'camp.status.draft',
    }
    return t(map[s])
  }

  const kpis = [
    { titleKey: 'camp.kpi.active' as TranslationKey, value: String(activeCount), icon: Megaphone, color: 'bg-primary-100', text: 'text-primary-700' },
    { titleKey: 'camp.kpi.reach' as TranslationKey, value: '265 k', icon: Users, color: 'bg-accent-100', text: 'text-accent-600' },
    { titleKey: 'camp.kpi.avgCtr' as TranslationKey, value: '7.2 %', icon: TrendingUp, color: 'bg-success-100', text: 'text-success-700' },
    { titleKey: 'camp.kpi.totalUplift' as TranslationKey, value: '+52 %', icon: Activity, color: 'bg-warning-100', text: 'text-warning-700' },
  ]

  return (
    <Layout
      actions={
        <button className="btn-primary">
          <Plus size={16} /> {t('camp.new')}
        </button>
      }
    >
      <div className="space-y-6">
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

        {/* Featured campaign card */}
        <div className="card-flush bg-gradient-to-br from-primary-600 to-primary-800 text-white p-6 border-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-white/70 uppercase tracking-wider">Top campagne · {t('camp.activeCount', { n: activeCount })}</div>
              <h2 className="text-xl font-bold mt-1">{t('camp.demo3')}</h2>
              <p className="text-sm text-white/80 mt-1">EU customers · Email + Push + SMS · ML uplift +72%</p>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3 py-2 rounded-lg bg-white/15 backdrop-blur border border-white/20 text-sm font-medium hover:bg-white/20">
                <Sparkles size={14} className="inline mr-1.5" /> Optimiser ML
              </button>
              <button className="px-3 py-2 rounded-lg bg-white text-primary-700 text-sm font-medium hover:bg-white/90">
                Voir détails →
              </button>
            </div>
          </div>
        </div>

        {/* Campaigns table */}
        <div className="card-flush">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('camp.table.name')}</th>
                  <th>{t('camp.table.status')}</th>
                  <th>{t('camp.table.audience')}</th>
                  <th>{t('camp.table.channels')}</th>
                  <th>{t('camp.table.sent')}</th>
                  <th>{t('camp.table.ctr')}</th>
                  <th>{t('camp.table.uplift')}</th>
                  <th className="text-right pr-6">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {CAMPAIGNS.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="font-medium text-slate-900">{t(c.nameKey)}</div>
                      <div className="text-xs text-slate-400 font-mono">{c.id}</div>
                    </td>
                    <td>
                      <span className={statusClass(c.status)}>{statusText(c.status)}</span>
                    </td>
                    <td className="text-slate-600">{c.audience}</td>
                    <td>
                      <div className="flex items-center gap-1">
                        {c.channels.map((ch) => {
                          const Icon = channelIcon(ch)
                          return (
                            <span
                              key={ch}
                              title={ch}
                              className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center"
                            >
                              <Icon size={13} />
                            </span>
                          )
                        })}
                      </div>
                    </td>
                    <td>
                      {c.sent > 0 ? (
                        c.sent.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td>
                      {c.ctr > 0 ? (
                        <span className="font-medium text-slate-900">{c.ctr} %</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td>
                      {c.uplift > 0 ? (
                        <span className="badge badge-success">+{c.uplift} %</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="text-right pr-6">
                      {c.status === 'active' && (
                        <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title={t('camp.status.paused')}>
                          <Pause size={14} />
                        </button>
                      )}
                      {c.status === 'paused' && (
                        <button className="p-1.5 rounded hover:bg-slate-100 text-slate-500" title={t('camp.status.active')}>
                          <Play size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Campaigns
