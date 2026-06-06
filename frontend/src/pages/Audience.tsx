import { useState } from 'react'
import Layout from '@/components/common/Layout'
import { useTranslation } from '@/contexts/LanguageContext'
import type { TranslationKey } from '@/i18n/translations'
import {
  Plus,
  Search,
  Users,
  UserPlus,
  TrendingUp,
  TrendingDown,
  Mail,
  MessageSquare,
  Bell,
  Smartphone,
  Star,
  Moon,
  Globe2,
  Crown,
} from 'lucide-react'

interface Segment {
  id: string
  nameKey: TranslationKey
  descKey: TranslationKey
  size: number
  icon: any
  color: string
  text: string
}

interface UserRow {
  id: string
  name: string
  email: string
  segment: string
  channels: ('Email' | 'SMS' | 'Push' | 'WhatsApp')[]
  engagement: 'high' | 'medium' | 'low'
  lastActive: string
}

const SEGMENTS: Segment[] = [
  { id: 'S-01', nameKey: 'aud.segment.power', descKey: 'aud.segment.powerDesc', size: 1_524, icon: Star, color: 'bg-warning-100', text: 'text-warning-700' },
  { id: 'S-02', nameKey: 'aud.segment.dormant', descKey: 'aud.segment.dormantDesc', size: 4_812, icon: Moon, color: 'bg-slate-100', text: 'text-slate-600' },
  { id: 'S-03', nameKey: 'aud.segment.new', descKey: 'aud.segment.newDesc', size: 2_104, icon: UserPlus, color: 'bg-primary-100', text: 'text-primary-700' },
  { id: 'S-04', nameKey: 'aud.segment.eu', descKey: 'aud.segment.euDesc', size: 8_902, icon: Globe2, color: 'bg-accent-100', text: 'text-accent-600' },
  { id: 'S-05', nameKey: 'aud.segment.mobile', descKey: 'aud.segment.mobileDesc', size: 6_417, icon: Smartphone, color: 'bg-success-100', text: 'text-success-700' },
  { id: 'S-06', nameKey: 'aud.segment.vip', descKey: 'aud.segment.vipDesc', size: 248, icon: Crown, color: 'bg-danger-100', text: 'text-danger-700' },
]

const USERS: UserRow[] = [
  { id: 'U-7821', name: 'Sophie Martin', email: 'sophie.m@acme.io', segment: 'Power users', channels: ['Email', 'Push'], engagement: 'high', lastActive: '2 min' },
  { id: 'U-7820', name: 'James Brown', email: 'james@northstar.co', segment: 'VIP', channels: ['Email', 'SMS', 'WhatsApp'], engagement: 'high', lastActive: '12 min' },
  { id: 'U-7819', name: 'Liu Wei', email: 'liu.wei@globex.cn', segment: 'New', channels: ['Email'], engagement: 'medium', lastActive: '1 h' },
  { id: 'U-7818', name: 'Mariana Rossi', email: 'mariana@ilbianco.it', segment: 'EU audience', channels: ['Email', 'Push'], engagement: 'medium', lastActive: '3 h' },
  { id: 'U-7817', name: 'Ahmed Hassan', email: 'ahmed.h@example.eg', segment: 'Mobile-first', channels: ['Push'], engagement: 'low', lastActive: '2 j' },
  { id: 'U-7816', name: 'Emma Wilson', email: 'emma.w@acme.io', segment: 'Dormant', channels: ['Email'], engagement: 'low', lastActive: '34 j' },
  { id: 'U-7815', name: 'Carlos García', email: 'carlos@madrid.es', segment: 'EU audience', channels: ['SMS', 'WhatsApp'], engagement: 'high', lastActive: '8 min' },
  { id: 'U-7814', name: 'Yuki Tanaka', email: 'yuki.t@kanto.jp', segment: 'Power users', channels: ['Push'], engagement: 'high', lastActive: '24 min' },
]

const channelIcon = (c: 'Email' | 'SMS' | 'Push' | 'WhatsApp') => {
  if (c === 'Email') return Mail
  if (c === 'SMS') return MessageSquare
  if (c === 'Push') return Bell
  return Smartphone
}

const engBadge = (e: 'high' | 'medium' | 'low') => {
  if (e === 'high') return 'badge badge-success'
  if (e === 'medium') return 'badge badge-warning'
  return 'badge badge-neutral'
}

const Audience = () => {
  const { t, language } = useTranslation()
  const [tab, setTab] = useState<'segments' | 'users'>('segments')
  const [search, setSearch] = useState('')

  const kpis = [
    { titleKey: 'aud.kpi.total' as TranslationKey, value: '15 234', icon: Users, color: 'bg-primary-100', text: 'text-primary-700' },
    { titleKey: 'aud.kpi.active30' as TranslationKey, value: '11 902', icon: TrendingUp, color: 'bg-success-100', text: 'text-success-700' },
    { titleKey: 'aud.kpi.new30' as TranslationKey, value: '2 104', icon: UserPlus, color: 'bg-accent-100', text: 'text-accent-600' },
    { titleKey: 'aud.kpi.churn' as TranslationKey, value: '3.2 %', icon: TrendingDown, color: 'bg-danger-100', text: 'text-danger-700' },
  ]

  const engText = (e: 'high' | 'medium' | 'low') => {
    if (e === 'high') return t('aud.engagement.high')
    if (e === 'medium') return t('aud.engagement.medium')
    return t('aud.engagement.low')
  }

  const filteredUsers = USERS.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.segment.toLowerCase().includes(q)
    )
  })

  return (
    <Layout
      actions={
        <button className="btn-primary">
          <Plus size={16} /> {t('aud.new')}
        </button>
      }
    >
      <div className="space-y-6">
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

        {/* Tabs + search */}
        <div className="card-flush p-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 border border-slate-200">
            <button
              onClick={() => setTab('segments')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === 'segments' ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('aud.tab.segments')}
            </button>
            <button
              onClick={() => setTab('users')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                tab === 'users' ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {t('aud.tab.users')}
            </button>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder={t('aud.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Content */}
        {tab === 'segments' ? (
          <>
            <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
              {t('aud.segment.title')}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {SEGMENTS.map((s) => (
                <div key={s.id} className="card flex flex-col gap-3 hover:shadow-elevated transition-shadow cursor-pointer">
                  <div className="flex items-start justify-between">
                    <div className={`stat-icon-wrap ${s.color}`}>
                      <s.icon size={18} className={s.text} />
                    </div>
                    <span className="text-xs font-mono text-slate-400">{s.id}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{t(s.nameKey)}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{t(s.descKey)}</div>
                  </div>
                  <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div>
                      <div className="text-2xl font-bold text-slate-900">
                        {s.size.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US')}
                      </div>
                      <div className="text-xs text-slate-500">{t('aud.kpi.total').toLowerCase()}</div>
                    </div>
                    <button className="btn-secondary text-xs">
                      {t('common.viewAll')} →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="card-flush">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('aud.table.user')}</th>
                    <th>{t('aud.table.segment')}</th>
                    <th>{t('aud.table.channels')}</th>
                    <th>{t('aud.table.engagement')}</th>
                    <th>{t('aud.table.lastActive')}</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 text-xs font-semibold flex items-center justify-center">
                            {u.name.split(' ').map((p) => p[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <div className="font-medium text-slate-900">{u.name}</div>
                            <div className="text-xs text-slate-500">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-slate-600">{u.segment}</td>
                      <td>
                        <div className="flex items-center gap-1">
                          {u.channels.map((c) => {
                            const Icon = channelIcon(c)
                            return (
                              <span
                                key={c}
                                title={c}
                                className="w-7 h-7 rounded-md bg-slate-100 text-slate-600 flex items-center justify-center"
                              >
                                <Icon size={13} />
                              </span>
                            )
                          })}
                        </div>
                      </td>
                      <td>
                        <span className={engBadge(u.engagement)}>{engText(u.engagement)}</span>
                      </td>
                      <td className="text-slate-500 text-xs">{u.lastActive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Audience
