import { useMemo, useState } from 'react'
import Layout from '@/components/common/Layout'
import { useAuth } from '@/contexts/AuthContext'
import {
  Send,
  MousePointerClick,
  Clock,
  CheckCircle2,
  Mail,
  MessageSquare,
  Smartphone,
  Plus,
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Bell,
} from 'lucide-react'

type Channel = 'Email' | 'SMS' | 'Push' | 'WhatsApp'
type StatusKey = 'sent' | 'scheduled' | 'failed' | 'inProgress'

interface Notification {
  id: string
  title: string
  channel: Channel
  recipients: number
  statusKey: StatusKey
  optimalTime: string
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

const statusLabel = (s: StatusKey) => {
  if (s === 'sent') return 'Sent'
  if (s === 'scheduled') return 'Scheduled'
  if (s === 'inProgress') return 'In progress'
  return 'Failed'
}

const demoNotifications: Notification[] = [
  { id: 'N-9412', title: 'Weekend promo -20%', channel: 'Email', recipients: 12_430, statusKey: 'sent', optimalTime: '7:30 PM', ctr: 6.2 },
  { id: 'N-9411', title: 'Order confirmation', channel: 'SMS', recipients: 1_204, statusKey: 'sent', optimalTime: '10:15 AM', ctr: 14.8 },
  { id: 'N-9410', title: 'New feature available', channel: 'Push', recipients: 48_902, statusKey: 'inProgress', optimalTime: '8:00 PM', ctr: 5.4 },
  { id: 'N-9409', title: 'Abandoned cart reminder', channel: 'Email', recipients: 3_817, statusKey: 'scheduled', optimalTime: 'Tomorrow 9:45 AM', ctr: 0 },
  { id: 'N-9408', title: 'Verification code', channel: 'SMS', recipients: 842, statusKey: 'failed', optimalTime: '2:02 PM', ctr: 0 },
  { id: 'N-9407', title: 'Monthly newsletter', channel: 'Email', recipients: 65_201, statusKey: 'sent', optimalTime: '6:45 PM', ctr: 4.1 },
]

const SUGGESTIONS = ['Today 7:30 PM', 'Tomorrow 9:45 AM', 'Today 8:15 PM', 'Tomorrow 6:00 PM']

const AUDIENCES = [
  'All active users',
  'Power users (top 10%)',
  'Inactive 7+ days',
  'New cohort (30 d)',
]

const kpis = [
  { title: 'Notifications sent (7d)', value: '186,432', icon: Send, trend: '+12.4%', up: true, color: 'primary' },
  { title: 'Average click rate', value: '5.8 %', icon: MousePointerClick, trend: '+1.9 pts vs baseline', up: true, color: 'success' },
  { title: 'p99 inference latency', value: '87 ms', icon: Clock, trend: '-13 ms', up: true, color: 'accent' },
  { title: 'Deliverability', value: '99.4 %', icon: CheckCircle2, trend: '+0.2 pts', up: true, color: 'success' },
]

const colorMap: Record<string, { bg: string; text: string }> = {
  primary: { bg: 'bg-primary-100', text: 'text-primary-700' },
  success: { bg: 'bg-success-100', text: 'text-success-700' },
  accent: { bg: 'bg-accent-100', text: 'text-accent-600' },
  warning: { bg: 'bg-warning-100', text: 'text-warning-700' },
}

const Dashboard = () => {
  const { user } = useAuth()
  const [channel, setChannel] = useState<Channel>('Email')
  const [audience, setAudience] = useState(AUDIENCES[0])
  const [message, setMessage] = useState('')
  const [optimalSuggestion, setOptimalSuggestion] = useState<string | null>(null)
  const [scheduling, setScheduling] = useState(false)
  const [scheduled, setScheduled] = useState<{ at: string; channel: Channel } | null>(null)

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const today = useMemo(
    () => new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
    []
  )

  const computeOptimal = () => {
    setOptimalSuggestion(SUGGESTIONS[Math.floor(Math.random() * SUGGESTIONS.length)])
  }

  const handleSchedule = (e: React.FormEvent) => {
    e.preventDefault()
    setScheduling(true)
    setTimeout(() => {
      setScheduling(false)
      setScheduled({ at: optimalSuggestion || SUGGESTIONS[0], channel })
      setMessage('')
      setOptimalSuggestion(null)
    }, 800)
  }

  const channelRows = [
    { ch: 'Email' as Channel, pct: 52, count: '97 k', color: 'bg-primary-500' },
    { ch: 'Push' as Channel, pct: 28, count: '52 k', color: 'bg-accent-500' },
    { ch: 'SMS' as Channel, pct: 14, count: '26 k', color: 'bg-success-500' },
    { ch: 'WhatsApp' as Channel, pct: 6, count: '11 k', color: 'bg-warning-500' },
  ]

  return (
    <Layout
      actions={
        <>
          <button className="btn-secondary">
            <Calendar size={16} /> Last 7 days
          </button>
          <button className="btn-primary">
            <Plus size={16} /> New notification
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="card-flush bg-gradient-to-br from-primary-600 to-primary-800 text-white p-6 flex flex-wrap items-center justify-between gap-4 border-0">
          <div>
            <div className="text-xs text-white/70 uppercase tracking-wider">{today}</div>
            <h2 className="text-2xl font-bold mt-1">
              {greeting}, {user?.email?.split('@')[0] || 'User'} 👋
            </h2>
            <p className="text-sm text-white/80 mt-1 max-w-xl">
              Your ML-optimized campaigns are outperforming baseline by <strong className="font-semibold">+66%</strong> this week.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 rounded-lg bg-white/15 backdrop-blur border border-white/20">
              <div className="text-xs text-white/70">ML model active</div>
              <div className="font-semibold flex items-center gap-1.5">
                <Sparkles size={14} /> XGBoost v2.4 · AUC 0.78
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {kpis.map((k) => {
            const c = colorMap[k.color] || colorMap.primary
            const Trend = k.up ? ArrowUpRight : ArrowDownRight
            return (
              <div key={k.title} className="stat-card">
                <div className="flex items-start justify-between">
                  <div className={`stat-icon-wrap ${c.bg}`}>
                    <k.icon size={18} className={c.text} />
                  </div>
                  <div className={`flex items-center gap-0.5 text-xs font-medium ${k.up ? 'text-success-700' : 'text-danger-700'}`}>
                    <Trend size={14} />
                    {k.trend}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">{k.title}</div>
                  <div className="text-2xl font-bold text-slate-900 mt-1">{k.value}</div>
                </div>
              </div>
            )
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Schedule a notification</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  The ML model picks the optimal moment for each user.
                </p>
              </div>
              <span className="badge badge-info">Demo mode</span>
            </div>

            {scheduled && (
              <div className="mb-4 p-3 rounded-lg bg-success-50 border border-success-100 flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-success-600 mt-0.5" />
                <div className="text-sm text-success-800 flex-1">
                  Notification scheduled on <strong>{scheduled.channel}</strong> for <strong>{scheduled.at}</strong>.
                </div>
                <button
                  onClick={() => setScheduled(null)}
                  className="text-xs text-success-700 hover:underline"
                >
                  Close
                </button>
              </div>
            )}

            <form onSubmit={handleSchedule} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Channel</label>
                <select
                  className="select"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as Channel)}
                >
                  <option>Email</option>
                  <option>SMS</option>
                  <option>Push</option>
                  <option>WhatsApp</option>
                </select>
              </div>
              <div>
                <label className="label">Audience</label>
                <select className="select" value={audience} onChange={(e) => setAudience(e.target.value)}>
                  {AUDIENCES.map((a) => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="label">Message</label>
                <textarea
                  className="input min-h-[88px]"
                  placeholder="E.g. Your discount code expires soon..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  maxLength={160}
                />
                <div className="text-xs text-slate-400 mt-1">{message.length} / 160</div>
              </div>
              <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <button type="button" onClick={computeOptimal} className="btn-secondary">
                  <Sparkles size={16} /> Compute optimal time
                </button>
                {optimalSuggestion && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-50 border border-primary-100 text-sm text-primary-800">
                    <Clock size={14} className="text-primary-600" />
                    ML suggestion: <strong>{optimalSuggestion}</strong>
                  </div>
                )}
                <button type="submit" className="btn-primary" disabled={scheduling || !message}>
                  {scheduling ? 'Scheduling...' : 'Schedule'}
                </button>
              </div>
            </form>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold text-slate-900 mb-1">Channel breakdown</h3>
            <p className="text-xs text-slate-500 mb-5">Last 7 days</p>
            <div className="space-y-4">
              {channelRows.map((row) => {
                const Icon = channelIcon(row.ch)
                return (
                  <div key={row.ch}>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <div className="flex items-center gap-2 text-slate-700">
                        <Icon size={14} className="text-slate-500" />
                        {row.ch}
                      </div>
                      <div className="text-slate-500">
                        {row.count} <span className="text-slate-400">({row.pct}%)</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div className={`${row.color} h-full rounded-full`} style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        <div className="card-flush">
          <div className="flex items-center justify-between px-6 pt-5 pb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Recent notifications</h3>
              <p className="text-xs text-slate-500 mt-0.5">Last 24 hours</p>
            </div>
            <button className="btn-ghost text-sm">View all</button>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Channel</th>
                  <th>Recipients</th>
                  <th>Optimal time</th>
                  <th>CTR</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {demoNotifications.map((n) => {
                  const Icon = channelIcon(n.channel)
                  return (
                    <tr key={n.id}>
                      <td className="font-mono text-xs text-slate-500">{n.id}</td>
                      <td className="font-medium text-slate-900">{n.title}</td>
                      <td>
                        <span className="inline-flex items-center gap-1.5 text-slate-700">
                          <Icon size={14} className="text-slate-400" />
                          {n.channel}
                        </span>
                      </td>
                      <td>{n.recipients.toLocaleString('en-US')}</td>
                      <td className="text-slate-500">{n.optimalTime}</td>
                      <td>
                        {n.ctr > 0 ? (
                          <span className="font-medium text-slate-900">{n.ctr} %</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td>
                        <span className={statusBadge(n.statusKey)}>{statusLabel(n.statusKey)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  )
}

export default Dashboard
