import { useEffect, useMemo, useState } from 'react'
import Layout from '@/components/common/Layout'
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Gauge,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { getAttentionSummary, previewDecision, scheduleDecision } from '@/api/decisions'
import type { AttentionSummaryResponse, DecisionResponse, MessageCategory, PriorityClass } from '@/types'

type Channel = 'AUTO' | 'EMAIL' | 'SMS' | 'PUSH'

interface DecisionRow {
  decisionId: string
  userId: string
  sourceId: string
  channel: Channel
  messageCategory: MessageCategory
  priorityClass: PriorityClass
  attentionDecision: 'SEND' | 'DEFER'
  attentionCost: number
  attentionValue: number
  fatigueScore: number
  sourceTrustScore: number
  scheduledTime?: string
  reason: string
}

const decisionRows: DecisionRow[] = [
  {
    decisionId: 'attn_f2dc4906',
    userId: 'pilot_user_3',
    sourceId: 'campaign:abandoned_cart',
    channel: 'EMAIL',
    messageCategory: 'MARKETING',
    priorityClass: 'STANDARD',
    attentionDecision: 'SEND',
    attentionCost: 1.5,
    attentionValue: 6.2,
    fatigueScore: 0,
    sourceTrustScore: 0.75,
    scheduledTime: '2026-06-21T08:00Z',
    reason: 'Predicted value exceeds attention cost',
  },
  {
    decisionId: 'attn_c3e08e61',
    userId: 'pilot_user_1',
    sourceId: 'campaign:abandoned_cart',
    channel: 'EMAIL',
    messageCategory: 'MARKETING',
    priorityClass: 'LOW',
    attentionDecision: 'DEFER',
    attentionCost: 4.795,
    attentionValue: 4.3,
    fatigueScore: 0.565,
    sourceTrustScore: 0.75,
    reason: 'Marketing message deferred because attention cost is higher than value',
  },
  {
    decisionId: 'attn_security_demo',
    userId: 'pilot_user_2',
    sourceId: 'template:login_alert',
    channel: 'SMS',
    messageCategory: 'SECURITY',
    priorityClass: 'SECURITY',
    attentionDecision: 'SEND',
    attentionCost: 1.2,
    attentionValue: 8.8,
    fatigueScore: 0.42,
    sourceTrustScore: 0.84,
    scheduledTime: 'Immediate',
    reason: 'Priority class bypasses attention budget',
  },
]

const categories: MessageCategory[] = [
  'GENERAL',
  'MARKETING',
  'PROMOTION',
  'NEWSLETTER',
  'TRANSACTIONAL',
  'SECURITY',
  'EMERGENCY',
]

const priorities: PriorityClass[] = ['LOW', 'STANDARD', 'HIGH', 'TRANSACTIONAL', 'SECURITY', 'EMERGENCY']
const channels: Channel[] = ['AUTO', 'EMAIL', 'SMS', 'PUSH']

const decisionBadge = (decision: 'SEND' | 'DEFER') =>
  decision === 'SEND' ? 'badge badge-success' : 'badge badge-warning'

const Attention = () => {
  const [loading, setLoading] = useState<'preview' | 'schedule' | null>(null)
  const [error, setError] = useState('')
  const [result, setResult] = useState<DecisionResponse | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [summaryData, setSummaryData] = useState<AttentionSummaryResponse | null>(null)
  const [filters, setFilters] = useState({
    sourceId: '',
    userId: '',
    limit: 200,
  })
  const [form, setForm] = useState({
    userId: 'pilot_user_3',
    sourceId: 'campaign:abandoned_cart',
    channel: 'EMAIL' as Channel,
    messageCategory: 'MARKETING' as MessageCategory,
    priorityClass: 'STANDARD' as PriorityClass,
    businessValue: 8,
    urgency: 0.6,
    message: 'You left something in your cart.',
    subject: 'Complete your order',
  })

  const windowStart = Math.floor(Date.now() / 1000)
  const windowEnd = windowStart + 86400

  const loadSummary = async () => {
    setSummaryLoading(true)
    setSummaryError('')
    try {
      const data = await getAttentionSummary({
        sourceId: filters.sourceId.trim() || undefined,
        userId: filters.userId.trim() || undefined,
        limit: filters.limit,
      })
      setSummaryData(data)
    } catch (err: any) {
      const status = err.response?.status
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to load attention summary'
      setSummaryError(status ? `HTTP ${status}: ${message}` : message)
      setSummaryData(null)
    } finally {
      setSummaryLoading(false)
    }
  }

  useEffect(() => {
    loadSummary()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const rows = useMemo<DecisionRow[]>(() => {
    if (summaryData) {
      return summaryData.recentDecisions.map((row) => ({
        decisionId: row.decisionId,
        userId: row.userId,
        sourceId: row.sourceId,
        channel: row.channel,
        messageCategory: row.messageCategory,
        priorityClass: row.priorityClass,
        attentionDecision: row.attentionDecision,
        attentionCost: row.attentionCost,
        attentionValue: row.attentionValue,
        fatigueScore: row.fatigueScore,
        sourceTrustScore: row.sourceTrustScore,
        reason: row.reason,
      }))
    }
    return decisionRows
  }, [summaryData])

  const summary = useMemo(() => {
    if (summaryData) {
      return {
        sent: summaryData.sendDecisions,
        deferred: summaryData.deferredDecisions,
        avgCost: summaryData.avgAttentionCost,
        avgValue: summaryData.avgAttentionValue,
        sendRate: summaryData.sendRate,
        deferRate: summaryData.deferRate,
        attentionProtected: summaryData.attentionProtected,
        estimatedAttentionSaved: summaryData.estimatedAttentionSaved,
        recommendation: summaryData.recommendation,
        scopeLabel: summaryData.scope.sourceId !== 'ALL'
          ? summaryData.scope.sourceId
          : summaryData.scope.userId !== 'ALL'
            ? summaryData.scope.userId
            : 'All recent decisions',
        isLive: true,
      }
    }

    const sent = decisionRows.filter((row) => row.attentionDecision === 'SEND').length
    const deferred = decisionRows.length - sent
    const avgCost = decisionRows.reduce((sum, row) => sum + row.attentionCost, 0) / decisionRows.length
    const avgValue = decisionRows.reduce((sum, row) => sum + row.attentionValue, 0) / decisionRows.length
    return {
      sent,
      deferred,
      avgCost,
      avgValue,
      sendRate: sent / decisionRows.length,
      deferRate: deferred / decisionRows.length,
      attentionProtected: deferred,
      estimatedAttentionSaved: decisionRows
        .filter((row) => row.attentionDecision === 'DEFER')
        .reduce((sum, row) => sum + row.attentionCost, 0),
      recommendation: 'Demo snapshot. Deploy /v1/attention/summary to power this from AttentionLedger.',
      scopeLabel: 'Demo decision sample',
      isLive: false,
    }
  }, [summaryData])

  const runDecision = async (mode: 'preview' | 'schedule') => {
    setLoading(mode)
    setError('')
    setResult(null)

    try {
      const request = {
        userId: form.userId,
        windowStart,
        windowEnd,
        channel: form.channel,
        sourceId: form.sourceId,
        messageCategory: form.messageCategory,
        priorityClass: form.priorityClass,
        businessValue: form.businessValue,
        urgency: form.urgency,
        message: form.message,
        metadata: form.subject ? { subject: form.subject } : undefined,
      }

      const response = mode === 'preview'
        ? await previewDecision(request)
        : await scheduleDecision(request)

      setResult(response)
    } catch (err: any) {
      const status = err.response?.status
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Decision request failed'
      setError(status ? `HTTP ${status}: ${message}` : message)
    } finally {
      setLoading(null)
    }
  }

  const scorePosition = (value: number) => `${Math.min(100, Math.max(0, value * 10))}%`
  const formatDateTime = (value?: string) => {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    })
  }

  return (
    <Layout
      actions={
        <button className="btn-primary" onClick={() => runDecision('preview')} disabled={loading !== null}>
          {loading === 'preview' ? <Loader2 className="animate-spin" size={16} /> : <ShieldCheck size={16} />}
          Preview Decision
        </button>
      }
    >
      <div className="space-y-6">
        <div className="card-flush p-4">
          <div className="flex flex-col lg:flex-row lg:items-end gap-4">
            <div className="flex-1">
              <div className="text-sm font-semibold text-slate-900">Business Scope</div>
              <div className="text-xs text-slate-500 mt-1">
                Measure decision quality for a campaign/source, a single user, or all recent AttentionLedger decisions.
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 lg:w-[640px]">
              <div>
                <label className="label">Source ID</label>
                <input
                  className="input"
                  placeholder="campaign:abandoned_cart"
                  value={filters.sourceId}
                  onChange={(e) => setFilters({ ...filters, sourceId: e.target.value, userId: '' })}
                />
              </div>
              <div>
                <label className="label">User ID</label>
                <input
                  className="input"
                  placeholder="pilot_user_3"
                  value={filters.userId}
                  onChange={(e) => setFilters({ ...filters, userId: e.target.value, sourceId: '' })}
                />
              </div>
              <div>
                <label className="label">Limit</label>
                <select
                  className="select"
                  value={filters.limit}
                  onChange={(e) => setFilters({ ...filters, limit: Number(e.target.value) })}
                >
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                  <option value={500}>500</option>
                </select>
              </div>
            </div>
            <button className="btn-secondary" onClick={loadSummary} disabled={summaryLoading}>
              {summaryLoading ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Refresh
            </button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className={`badge ${summary.isLive ? 'badge-success' : 'badge-warning'}`}>
              {summary.isLive ? 'Live AttentionLedger data' : 'Demo fallback'}
            </span>
            <span className="badge badge-neutral">Scope: {summary.scopeLabel}</span>
            {summaryError && <span className="text-xs text-warning-700">{summaryError}</span>}
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="stat-icon-wrap bg-success-100">
              <CheckCircle2 size={18} className="text-success-700" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Decision yield</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{Math.round(summary.sendRate * 100)}%</div>
              <div className="text-[11px] text-slate-400 mt-1">{summary.sent} messages cleared the gate</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap bg-warning-100">
              <XCircle size={18} className="text-warning-700" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Attention protected</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{summary.attentionProtected}</div>
              <div className="text-[11px] text-slate-400 mt-1">{Math.round(summary.deferRate * 100)}% deferred before send</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap bg-primary-100">
              <Gauge size={18} className="text-primary-700" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Avg attention cost</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{summary.avgCost.toFixed(2)}</div>
              <div className="text-[11px] text-slate-400 mt-1">Lower means less user fatigue risk</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrap bg-slate-100">
              <SlidersHorizontal size={18} className="text-slate-700" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Value-cost spread</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{summary.avgValue.toFixed(2)}</div>
              <div className="text-[11px] text-slate-400 mt-1">
                Avg value, saved cost {summary.estimatedAttentionSaved.toFixed(1)}
              </div>
            </div>
          </div>
        </div>

        <div className="card bg-primary-50 border-primary-100">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="text-primary-700 mt-0.5" />
            <div>
              <div className="font-semibold text-slate-900">Business Recommendation</div>
              <div className="text-sm text-slate-700 mt-1">{summary.recommendation}</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
          <div className="card-flush">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-900">Recent Attention Decisions</h3>
              <p className="text-xs text-slate-500 mt-1">
                {summary.isLive
                  ? 'Loaded from AttentionLedger for the selected business scope.'
                  : 'Demo decision sample until /v1/attention/summary is deployed.'}
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Decision</th>
                    <th>User</th>
                    <th>Source</th>
                    <th>Policy</th>
                    <th>Cost</th>
                    <th>Value</th>
                    <th>Fatigue</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-slate-500 py-10">
                        No Attention Escrow decisions found for this scope yet.
                      </td>
                    </tr>
                  ) : rows.map((row) => (
                    <tr key={row.decisionId}>
                      <td>
                        <span className={decisionBadge(row.attentionDecision)}>{row.attentionDecision}</span>
                      </td>
                      <td>
                        <div className="font-medium text-slate-900">{row.userId}</div>
                        <div className="text-xs text-slate-400 font-mono">{row.decisionId}</div>
                      </td>
                      <td className="text-slate-600">{row.sourceId}</td>
                      <td>
                        <div className="text-slate-900">{row.messageCategory}</div>
                        <div className="text-xs text-slate-500">{row.priorityClass} / {row.channel}</div>
                      </td>
                      <td>
                        <div className="font-medium text-slate-900">{row.attentionCost.toFixed(3)}</div>
                      </td>
                      <td>
                        <div className="font-medium text-slate-900">{row.attentionValue.toFixed(3)}</div>
                      </td>
                      <td>{Math.round(row.fatigueScore * 100)}%</td>
                      <td className="max-w-xs text-slate-500">{row.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="font-semibold text-slate-900 mb-4">Decision Tester</h3>
            <div className="space-y-4">
              <div>
                <label className="label">User ID</label>
                <input
                  className="input"
                  value={form.userId}
                  onChange={(e) => setForm({ ...form, userId: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Source ID</label>
                <input
                  className="input"
                  value={form.sourceId}
                  onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Channel</label>
                  <select
                    className="select"
                    value={form.channel}
                    onChange={(e) => setForm({ ...form, channel: e.target.value as Channel })}
                  >
                    {channels.map((channel) => <option key={channel}>{channel}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Priority</label>
                  <select
                    className="select"
                    value={form.priorityClass}
                    onChange={(e) => setForm({ ...form, priorityClass: e.target.value as PriorityClass })}
                  >
                    {priorities.map((priority) => <option key={priority}>{priority}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Category</label>
                <select
                  className="select"
                  value={form.messageCategory}
                  onChange={(e) => setForm({ ...form, messageCategory: e.target.value as MessageCategory })}
                >
                  {categories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Business Value: {form.businessValue.toFixed(1)}</label>
                <input
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={form.businessValue}
                  onChange={(e) => setForm({ ...form, businessValue: Number(e.target.value) })}
                  className="w-full accent-primary-600"
                />
              </div>
              <div>
                <label className="label">Urgency: {form.urgency.toFixed(1)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={form.urgency}
                  onChange={(e) => setForm({ ...form, urgency: Number(e.target.value) })}
                  className="w-full accent-primary-600"
                />
              </div>
              <div>
                <label className="label">Subject</label>
                <input
                  className="input"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Message</label>
                <textarea
                  className="input"
                  rows={3}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
              </div>

              {error && (
                <div className="bg-danger-50 border border-danger-200 text-danger-700 text-sm p-3 rounded-lg flex items-start gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button className="btn-secondary" onClick={() => runDecision('preview')} disabled={loading !== null}>
                  {loading === 'preview' ? <Loader2 className="animate-spin" size={16} /> : <Clock size={16} />}
                  Preview
                </button>
                <button className="btn-primary" onClick={() => runDecision('schedule')} disabled={loading !== null}>
                  {loading === 'schedule' ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                  Schedule
                </button>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <div className="card-flush overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary-700" />
                <h3 className="font-semibold text-slate-900">Latest Decision Result</h3>
              </div>
              <span className={decisionBadge(result.attentionDecision || 'DEFER')}>
                {result.attentionDecision || 'UNKNOWN'}
              </span>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-0 border-b border-slate-100">
              <div className="p-5 border-b lg:border-b-0 lg:border-r border-slate-100">
                <div className="text-xs text-slate-500">Attention cost</div>
                <div className="text-2xl font-bold text-slate-900">{result.attentionCost?.toFixed(3) ?? '-'}</div>
                <div className="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-warning-500" style={{ width: scorePosition(result.attentionCost ?? 0) }} />
                </div>
              </div>
              <div className="p-5 border-b lg:border-b-0 lg:border-r border-slate-100">
                <div className="text-xs text-slate-500">Attention value</div>
                <div className="text-2xl font-bold text-slate-900">{result.attentionValue?.toFixed(3) ?? '-'}</div>
                <div className="h-2 bg-slate-100 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-success-500" style={{ width: scorePosition(result.attentionValue ?? 0) }} />
                </div>
              </div>
              <div className="p-5 border-b lg:border-b-0 lg:border-r border-slate-100 bg-primary-50/50">
                <div className="text-xs text-primary-700 font-medium">Recommended send time</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{formatDateTime(result.recommendedSendTime || result.scheduledTime)}</div>
                <div className="text-sm text-slate-500 mt-2 flex items-center gap-2">
                  <CalendarClock size={14} />
                  Best hour: {typeof result.hour === 'number' ? `${result.hour}:00 UTC` : '-'}
                </div>
              </div>
              <div className="p-5">
                <div className="text-xs text-slate-500">Schedule status</div>
                <div className="text-2xl font-bold text-slate-900">
                  {result.scheduled ? 'Created' : result.attentionDecision === 'SEND' ? 'Ready' : 'Skipped'}
                </div>
                <div className="text-sm text-slate-500 mt-2 flex items-center gap-2">
                  <Clock size={14} />
                  {result.scheduleSkippedReason || (result.scheduled ? result.scheduleId : 'Click Schedule to create it')}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-b border-slate-100">
              <div className="p-5 border-b md:border-b-0 md:border-r border-slate-100">
                <div className="text-xs text-slate-500">Best-hour click probability</div>
                <div className="text-2xl font-bold text-slate-900">{Math.round((result.probability ?? 0) * 100)}%</div>
              </div>
              <div className="p-5 border-b md:border-b-0 md:border-r border-slate-100">
                <div className="text-xs text-slate-500">If sent now</div>
                <div className="text-2xl font-bold text-slate-900">{Math.round((result.sendNowProbability ?? 0) * 100)}%</div>
                <div className="text-xs text-slate-500 mt-1">
                  Current model hour: {typeof result.sendNowHour === 'number' ? `${result.sendNowHour}:00 UTC` : '-'}
                </div>
              </div>
              <div className="p-5">
                <div className="text-xs text-slate-500">Lift from waiting</div>
                <div className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp size={20} className="text-success-600" />
                  {Math.round(((result.probability ?? 0) - (result.sendNowProbability ?? 0)) * 100)} pts
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="text-sm text-slate-600">{result.attentionReason}</div>
              <pre className="mt-4 p-4 rounded-lg bg-slate-950 text-slate-100 text-xs overflow-x-auto">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Attention
