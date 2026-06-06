import { useState } from 'react'
import Layout from '@/components/common/Layout'
import { useTranslation } from '@/contexts/LanguageContext'
import type { TranslationKey } from '@/i18n/translations'
import {
  Plus,
  Key,
  Eye,
  EyeOff,
  Copy,
  CheckCircle2,
  Trash2,
  Webhook,
  ExternalLink,
  Terminal,
  Lock,
} from 'lucide-react'

type Env = 'prod' | 'staging' | 'dev'

interface ApiKey {
  id: string
  name: string
  key: string
  env: Env
  created: string
  lastUsed: string
}

const KEYS: ApiKey[] = [
  { id: 'K-01', name: 'Backend service', key: 'snre_live_DEMO_aaaaaaaaaaaaaaaaaaaaaa01', env: 'prod', created: '2026-01-12', lastUsed: '2 min' },
  { id: 'K-02', name: 'Mobile app', key: 'snre_live_DEMO_bbbbbbbbbbbbbbbbbbbbbb02', env: 'prod', created: '2026-02-03', lastUsed: '4 h' },
  { id: 'K-03', name: 'CI pipeline', key: 'snre_test_DEMO_cccccccccccccccccccccc03', env: 'staging', created: '2026-03-15', lastUsed: '1 j' },
  { id: 'K-04', name: 'Local dev — Alice', key: 'snre_test_DEMO_dddddddddddddddddddddd04', env: 'dev', created: '2026-04-22', lastUsed: '12 j' },
]

const envBadge = (e: Env) => {
  if (e === 'prod') return 'badge badge-danger'
  if (e === 'staging') return 'badge badge-warning'
  return 'badge badge-info'
}

const maskKey = (k: string) => `${k.slice(0, 12)}${'•'.repeat(20)}${k.slice(-4)}`

const ApiKeys = () => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<'keys' | 'webhooks'>('keys')
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCopy = async (id: string, key: string) => {
    try {
      await navigator.clipboard.writeText(key)
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      /* clipboard might fail in some browsers */
    }
  }

  const envKey = (e: Env): TranslationKey => {
    if (e === 'prod') return 'api.env.prod'
    if (e === 'staging') return 'api.env.staging'
    return 'api.env.dev'
  }

  const codeExample = `curl -X POST https://api.snre.io/v1/events \\
  -H "Authorization: Bearer \${SNRE_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_id": "u_12345",
    "event": "product_viewed",
    "channel": "email",
    "timestamp": "2026-06-06T19:32:00Z"
  }'`

  return (
    <Layout
      actions={
        <button className="btn-primary">
          <Plus size={16} /> {t('api.new')}
        </button>
      }
    >
      <div className="space-y-6">
        {/* Tabs */}
        <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-100 border border-slate-200 w-fit">
          <button
            onClick={() => setTab('keys')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              tab === 'keys' ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Key size={13} /> {t('api.tab.keys')}
          </button>
          <button
            onClick={() => setTab('webhooks')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
              tab === 'webhooks' ? 'bg-white text-slate-900 shadow-soft' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Webhook size={13} /> {t('api.tab.webhooks')}
          </button>
        </div>

        {tab === 'keys' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Keys table */}
              <div className="card-flush lg:col-span-2">
                <div className="px-6 pt-5 pb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">{t('api.keys.title')}</h3>
                    <p className="text-xs text-slate-500 mt-0.5 max-w-md">{t('api.keys.subtitle')}</p>
                  </div>
                  <span className="badge badge-warning inline-flex items-center gap-1">
                    <Lock size={11} /> Secret
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('api.table.name')}</th>
                        <th>{t('api.table.key')}</th>
                        <th>{t('api.table.env')}</th>
                        <th>{t('api.table.lastUsed')}</th>
                        <th className="text-right pr-6">{t('common.actions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {KEYS.map((k) => {
                        const isRevealed = revealed.has(k.id)
                        return (
                          <tr key={k.id}>
                            <td>
                              <div className="font-medium text-slate-900">{k.name}</div>
                              <div className="text-xs text-slate-400 font-mono">{k.id} · {k.created}</div>
                            </td>
                            <td>
                              <code className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-1 rounded">
                                {isRevealed ? k.key : maskKey(k.key)}
                              </code>
                            </td>
                            <td>
                              <span className={envBadge(k.env)}>{t(envKey(k.env))}</span>
                            </td>
                            <td className="text-slate-500 text-xs">{k.lastUsed}</td>
                            <td className="text-right pr-6">
                              <div className="inline-flex items-center gap-1">
                                <button
                                  onClick={() => toggleReveal(k.id)}
                                  className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                                  title={isRevealed ? 'Hide' : 'Reveal'}
                                >
                                  {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                                <button
                                  onClick={() => handleCopy(k.id, k.key)}
                                  className="p-1.5 rounded hover:bg-slate-100 text-slate-500"
                                  title={t('common.copy')}
                                >
                                  {copied === k.id ? (
                                    <CheckCircle2 size={14} className="text-success-600" />
                                  ) : (
                                    <Copy size={14} />
                                  )}
                                </button>
                                <button
                                  className="p-1.5 rounded hover:bg-danger-50 text-danger-600"
                                  title={t('api.revoke')}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Docs / example */}
              <div className="card flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <div className="stat-icon-wrap bg-accent-100">
                    <Terminal size={16} className="text-accent-600" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">{t('api.docs.title')}</h3>
                    <p className="text-xs text-slate-500">{t('api.docs.subtitle')}</p>
                  </div>
                </div>

                <div>
                  <div className="text-xs text-slate-500 mb-1.5">{t('api.docs.exampleTitle')}</div>
                  <pre className="text-xs bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto leading-relaxed font-mono">
                    {codeExample}
                  </pre>
                </div>

                <a
                  href="#"
                  className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline font-medium mt-1"
                >
                  {t('api.docs.viewFull')} <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </>
        )}

        {tab === 'webhooks' && (
          <div className="card text-center py-16">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary-100 mb-4">
              <Webhook className="w-7 h-7 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">{t('api.webhooks.title')}</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-sm mx-auto">{t('api.webhooks.subtitle')}</p>
            <p className="text-xs text-slate-400 mt-4">{t('api.webhooks.empty')}</p>
            <button className="btn-primary mt-5">
              <Plus size={16} /> {t('api.webhooks.add')}
            </button>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default ApiKeys
