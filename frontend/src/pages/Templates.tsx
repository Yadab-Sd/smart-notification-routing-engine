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
  Pencil,
  Copy,
  Trash2,
  Eye,
  FileText,
} from 'lucide-react'

type Channel = 'Email' | 'SMS' | 'Push' | 'WhatsApp'
type Tag = 'transactional' | 'marketing' | 'alert' | 'onboarding'

interface Template {
  id: string
  titleKey: TranslationKey
  bodyKey: TranslationKey
  channel: Channel
  tag: Tag
  usedCount: number
  lastUsed: string
}

const channelIcon = (c: Channel) => {
  if (c === 'Email') return Mail
  if (c === 'SMS') return MessageSquare
  if (c === 'Push') return Bell
  return Smartphone
}

const channelColor = (c: Channel) => {
  if (c === 'Email') return { bg: 'bg-primary-100', text: 'text-primary-700' }
  if (c === 'SMS') return { bg: 'bg-success-100', text: 'text-success-700' }
  if (c === 'Push') return { bg: 'bg-accent-100', text: 'text-accent-600' }
  return { bg: 'bg-warning-100', text: 'text-warning-700' }
}

const tagBadge = (tg: Tag) => {
  if (tg === 'transactional') return 'badge badge-info'
  if (tg === 'marketing') return 'badge badge-warning'
  if (tg === 'alert') return 'badge badge-danger'
  return 'badge badge-success'
}

const tagKey = (tg: Tag): TranslationKey => {
  if (tg === 'transactional') return 'tpl.tag.transactional'
  if (tg === 'marketing') return 'tpl.tag.marketing'
  if (tg === 'alert') return 'tpl.tag.alert'
  return 'tpl.tag.onboarding'
}

const TEMPLATES: Template[] = [
  { id: 'T-01', titleKey: 'tpl.demo1.title', bodyKey: 'tpl.demo1.body', channel: 'Email', tag: 'transactional', usedCount: 12_430, lastUsed: '2 h' },
  { id: 'T-02', titleKey: 'tpl.demo2.title', bodyKey: 'tpl.demo2.body', channel: 'Email', tag: 'onboarding', usedCount: 8_902, lastUsed: '5 h' },
  { id: 'T-03', titleKey: 'tpl.demo3.title', bodyKey: 'tpl.demo3.body', channel: 'Push', tag: 'marketing', usedCount: 4_817, lastUsed: '1 j' },
  { id: 'T-04', titleKey: 'tpl.demo4.title', bodyKey: 'tpl.demo4.body', channel: 'Email', tag: 'marketing', usedCount: 65_201, lastUsed: '12 h' },
  { id: 'T-05', titleKey: 'tpl.demo5.title', bodyKey: 'tpl.demo5.body', channel: 'SMS', tag: 'transactional', usedCount: 154_210, lastUsed: '3 min' },
  { id: 'T-06', titleKey: 'tpl.demo6.title', bodyKey: 'tpl.demo6.body', channel: 'WhatsApp', tag: 'alert', usedCount: 1_204, lastUsed: '4 j' },
]

const Templates = () => {
  const { t, language } = useTranslation()
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState<Channel | 'all'>('all')
  const [selected, setSelected] = useState<Template | null>(null)

  const filtered = useMemo(() => {
    return TEMPLATES.filter((tp) => {
      if (channelFilter !== 'all' && tp.channel !== channelFilter) return false
      if (search) {
        const q = search.toLowerCase()
        if (!t(tp.titleKey).toLowerCase().includes(q) && !t(tp.bodyKey).toLowerCase().includes(q)) {
          return false
        }
      }
      return true
    })
  }, [search, channelFilter, t])

  return (
    <Layout
      actions={
        <button className="btn-primary">
          <Plus size={16} /> {t('tpl.new')}
        </button>
      }
    >
      <div className="space-y-6">
        {/* Filters bar */}
        <div className="card-flush p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder={t('tpl.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="select w-44"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as Channel | 'all')}
          >
            <option value="all">{t('notifs.filterAll')} ({t('tpl.filterChannel').toLowerCase()})</option>
            <option>Email</option>
            <option>SMS</option>
            <option>Push</option>
            <option>WhatsApp</option>
          </select>
        </div>

        {/* Grid of cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((tp) => {
            const Icon = channelIcon(tp.channel)
            const color = channelColor(tp.channel)
            return (
              <div
                key={tp.id}
                className="card flex flex-col gap-3 hover:shadow-elevated transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className={`stat-icon-wrap ${color.bg}`}>
                    <Icon size={18} className={color.text} />
                  </div>
                  <span className={tagBadge(tp.tag)}>{t(tagKey(tp.tag))}</span>
                </div>

                <div>
                  <div className="font-semibold text-slate-900">{t(tp.titleKey)}</div>
                  <div className="text-xs text-slate-400 font-mono mt-0.5">{tp.id} · {tp.channel}</div>
                </div>

                <p className="text-sm text-slate-600 line-clamp-2 min-h-[40px]">
                  {t(tp.bodyKey)}
                </p>

                <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-100">
                  <span>{t('tpl.usedCount', { n: tp.usedCount.toLocaleString(language === 'fr' ? 'fr-FR' : 'en-US') })}</span>
                  <span>{t('tpl.lastUsed')}: {tp.lastUsed}</span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setSelected(tp)}
                    className="flex-1 btn-secondary text-xs py-2"
                  >
                    <Eye size={12} /> {t('tpl.preview')}
                  </button>
                  <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600" title={t('common.edit')}>
                    <Pencil size={14} />
                  </button>
                  <button className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600" title={t('common.duplicate')}>
                    <Copy size={14} />
                  </button>
                  <button className="p-2 rounded-lg border border-slate-200 hover:bg-danger-50 hover:border-danger-200 text-danger-600" title={t('common.delete')}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {filtered.length === 0 && (
          <div className="card text-center py-16 text-slate-500">
            <FileText className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            {t('common.noResults')}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 animate-fade-in"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl shadow-elevated border border-slate-100 max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-900">{t('tpl.preview')}</span>
                <span className={tagBadge(selected.tag)}>{t(tagKey(selected.tag))}</span>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="text-slate-500 hover:text-slate-900"
              >
                ✕
              </button>
            </div>
            <div className="p-5">
              <div className="text-xs text-slate-400 mb-2">{selected.channel} · {selected.id}</div>
              <div className="font-semibold text-slate-900 mb-2">{t(selected.titleKey)}</div>
              <div className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-lg border border-slate-100 whitespace-pre-wrap">
                {t(selected.bodyKey)}
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button onClick={() => setSelected(null)} className="btn-secondary text-sm">
                {t('common.close')}
              </button>
              <button className="btn-primary text-sm">
                <Pencil size={14} /> {t('common.edit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default Templates
