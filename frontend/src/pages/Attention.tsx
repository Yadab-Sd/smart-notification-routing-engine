import { useEffect, useMemo, useRef, useState } from 'react'
import Layout from '@/components/common/Layout'
import {
  AlertCircle,
  CalendarClock,
  CheckCircle2,
  Clock,
  Code2,
  Gauge,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  TrendingUp,
  XCircle,
} from 'lucide-react'
import { apiClient } from '@/api/client'
import { listCategories } from '@/api/categories'
import { getAttentionSummary, previewDecision, scheduleDecision } from '@/api/decisions'
import type { AttentionSummaryResponse, DecisionResponse, MessageCategory, NotificationCategory, PriorityClass } from '@/types'

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
    priorityClass: 'CRITICAL',
    attentionDecision: 'SEND',
    attentionCost: 1.2,
    attentionValue: 8.8,
    fatigueScore: 0.42,
    sourceTrustScore: 0.84,
    scheduledTime: 'Immediate',
    reason: 'Priority class bypasses attention budget',
  },
]

const messageCategories: MessageCategory[] = [
  'GENERAL',
  'MARKETING',
  'PROMOTION',
  'NEWSLETTER',
  'TRANSACTIONAL',
  'SECURITY',
  'EMERGENCY',
]

const priorities: PriorityClass[] = ['LOW', 'STANDARD', 'HIGH', 'URGENT', 'CRITICAL', 'EMERGENCY']
const channels: Channel[] = ['AUTO', 'EMAIL', 'SMS', 'PUSH']
const INITIAL_TABLE_ROWS = 10

const decisionBadge = (decision: 'SEND' | 'DEFER') =>
  decision === 'SEND' ? 'badge badge-success' : 'badge badge-warning'

const decisionPanelClass = (decision?: 'SEND' | 'DEFER') =>
  decision === 'SEND'
    ? 'bg-success-50 border-success-200 text-success-800'
    : decision === 'DEFER'
      ? 'bg-warning-50 border-warning-200 text-warning-800'
      : 'bg-slate-50 border-slate-200 text-slate-800'

const toDateTimeLocal = (date: Date) => {
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

const epochSecondsFromLocalInput = (value: string) => Math.floor(new Date(value).getTime() / 1000)
const utcFromLocalInput = (value: string) => {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '-' : date.toISOString()
}

const defaultDeliveryWindow = () => {
  const start = new Date()
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
  return {
    start: toDateTimeLocal(start),
    end: toDateTimeLocal(end),
    preset: 'next24h',
  }
}

const Attention = () => {
  const [loading, setLoading] = useState<'preview' | 'schedule' | 'sendNow' | null>(null)
  const [error, setError] = useState('')
  const [actionNotice, setActionNotice] = useState('')
  const [result, setResult] = useState<DecisionResponse | null>(null)
  const [showDeveloperDetails, setShowDeveloperDetails] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [summaryData, setSummaryData] = useState<AttentionSummaryResponse | null>(null)
  const [notificationCategories, setNotificationCategories] = useState<NotificationCategory[]>([])
  const [categoryLoadError, setCategoryLoadError] = useState('')
  const [showPolicyChanges, setShowPolicyChanges] = useState(false)
  const [showAllRows, setShowAllRows] = useState(false)
  const [filters, setFilters] = useState({
    sourceId: '',
    userId: '',
    limit: 200,
  })
  const [form, setForm] = useState({
    userId: 'pilot_user_3',
    categoryId: '',
    sourceId: 'campaign:abandoned_cart',
    channel: 'EMAIL' as Channel,
    messageCategory: 'MARKETING' as MessageCategory,
    priorityClass: 'STANDARD' as PriorityClass,
    businessValue: 8,
    urgency: 0.6,
    message: 'You left something in your cart.',
    subject: 'Complete your order',
  })
  const [deliveryWindow, setDeliveryWindow] = useState(defaultDeliveryWindow)

  const selectedCategory = useMemo(
    () => notificationCategories.find((category) => category.categoryId === form.categoryId),
    [notificationCategories, form.categoryId]
  )

  const categoryDefaults = useMemo(() => {
    if (!selectedCategory) return undefined
    return {
      categoryId: selectedCategory.categoryId,
      deliveryMode: selectedCategory.defaultDeliveryMode,
      allowedChannels: selectedCategory.allowedChannels,
      messageCategory: selectedCategory.messageCategory,
      riskClass: selectedCategory.riskClass,
      priorityClass: selectedCategory.priorityClass,
      businessValue: selectedCategory.businessValue,
      urgency: selectedCategory.urgency,
      maxDelayHours: selectedCategory.maxDelayHours,
      quietHoursRespect: selectedCategory.quietHoursRespect,
    }
  }, [selectedCategory])

  const effectivePolicy = useMemo(() => ({
    categoryId: form.categoryId || undefined,
    channel: form.channel,
    messageCategory: form.messageCategory,
    priorityClass: form.priorityClass,
    businessValue: form.businessValue,
    urgency: form.urgency,
  }), [form.categoryId, form.channel, form.messageCategory, form.priorityClass, form.businessValue, form.urgency])

  const policyOverrides = useMemo(() => {
    if (!selectedCategory) return undefined
    const overrides: Record<string, boolean> = {
      channel: selectedCategory.allowedChannels?.length === 1
        ? selectedCategory.allowedChannels[0] !== form.channel
        : false,
      priorityClass: selectedCategory.priorityClass !== form.priorityClass,
      businessValue: Math.abs(selectedCategory.businessValue - form.businessValue) > 0.001,
      urgency: Math.abs(selectedCategory.urgency - form.urgency) > 0.001,
    }
    return overrides
  }, [selectedCategory, form.channel, form.messageCategory, form.priorityClass, form.businessValue, form.urgency])

  const overrideCount = useMemo(
    () => Object.values(policyOverrides || {}).filter(Boolean).length,
    [policyOverrides]
  )

  const categoryPolicyDiffs = useMemo(() => {
    if (!selectedCategory || !policyOverrides) return []

    const rows = [
      {
        key: 'channel',
        label: 'Channel',
        defaultValue: selectedCategory.allowedChannels?.length === 1 ? selectedCategory.allowedChannels[0] : 'Any allowed',
        currentValue: form.channel,
      },
      {
        key: 'priorityClass',
        label: 'Priority',
        defaultValue: selectedCategory.priorityClass,
        currentValue: form.priorityClass,
      },
      {
        key: 'businessValue',
        label: 'Business value',
        defaultValue: selectedCategory.businessValue.toFixed(1),
        currentValue: form.businessValue.toFixed(1),
      },
      {
        key: 'urgency',
        label: 'Urgency',
        defaultValue: selectedCategory.urgency.toFixed(1),
        currentValue: form.urgency.toFixed(1),
      },
    ]

    return rows.map((row) => ({
      ...row,
      changed: Boolean(policyOverrides[row.key]),
    }))
  }, [selectedCategory, policyOverrides, form.channel, form.priorityClass, form.businessValue, form.urgency])

  useEffect(() => {
    if (!result) return
    requestAnimationFrame(() => {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [result])

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

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const data = await listCategories()
        setNotificationCategories(data.categories.filter((category) => category.active !== false))
        setCategoryLoadError('')
      } catch (err: any) {
        const status = err.response?.status
        const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to load categories'
        setCategoryLoadError(status ? `HTTP ${status}: ${message}` : message)
      }
    }
    loadCategories()
  }, [])

  const applyCategory = (categoryId: string) => {
    const category = notificationCategories.find((item) => item.categoryId === categoryId)
    if (!category) {
      setForm({ ...form, categoryId })
      return
    }

    setForm({
      ...form,
      categoryId,
      channel: category.allowedChannels?.[0] || form.channel,
      messageCategory: category.messageCategory,
      priorityClass: category.priorityClass,
      businessValue: category.businessValue,
      urgency: category.urgency,
      sourceId: form.sourceId || `category:${category.categoryId}`,
    })
  }

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

  const visibleRows = showAllRows ? rows : rows.slice(0, INITIAL_TABLE_ROWS)

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

  const applyWindowPreset = (preset: 'next24h' | 'today' | 'tomorrow' | 'next48h') => {
    const now = new Date()
    let start = new Date(now)
    let end = new Date(now)

    if (preset === 'next24h') {
      end = new Date(start.getTime() + 24 * 60 * 60 * 1000)
    } else if (preset === 'next48h') {
      end = new Date(start.getTime() + 48 * 60 * 60 * 1000)
    } else if (preset === 'today') {
      end = new Date(now)
      end.setHours(23, 59, 0, 0)
    } else {
      start = new Date(now)
      start.setDate(start.getDate() + 1)
      start.setHours(9, 0, 0, 0)
      end = new Date(start)
      end.setHours(17, 0, 0, 0)
    }

    setDeliveryWindow({
      start: toDateTimeLocal(start),
      end: toDateTimeLocal(end),
      preset,
    })
  }

  const buildDecisionRequest = () => ({
    userId: form.userId,
    windowStart: epochSecondsFromLocalInput(deliveryWindow.start),
    windowEnd: epochSecondsFromLocalInput(deliveryWindow.end),
    channel: form.channel,
    sourceId: form.sourceId,
    categoryId: form.categoryId || undefined,
    messageCategory: form.messageCategory,
    priorityClass: form.priorityClass,
    businessValue: form.businessValue,
    urgency: form.urgency,
    message: form.message,
    metadata: {
      ...(form.subject ? { subject: form.subject } : {}),
      attentionPolicyAudit: {
        categoryDefaults,
        effectivePolicy,
        policyOverrides,
      },
    },
  })

  const runDecision = async (mode: 'preview' | 'schedule') => {
    setLoading(mode)
    setError('')
    setActionNotice('')
    if (mode === 'preview') setResult(null)
    if (mode === 'preview') setShowDeveloperDetails(false)

    try {
      const request = buildDecisionRequest()

      if (Number.isNaN(request.windowStart) || Number.isNaN(request.windowEnd)) {
        throw new Error('Choose a valid delivery window.')
      }
      if (request.windowEnd <= request.windowStart) {
        throw new Error('Delivery window end must be after start.')
      }
      const response = mode === 'preview'
        ? await previewDecision(request)
        : await scheduleDecision(request)

      setResult(response)
      if (mode === 'schedule' && response.scheduled) {
        setActionNotice('Recommended send time scheduled.')
      }
    } catch (err: any) {
      const status = err.response?.status
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Decision request failed'
      setError(status ? `HTTP ${status}: ${message}` : message)
    } finally {
      setLoading(null)
    }
  }

  const sendNow = async () => {
    setLoading('sendNow')
    setError('')
    setActionNotice('')

    try {
      await apiClient.post('/v1/events', {
        userId: form.userId,
        type: 'MANUAL_ATTENTION_SEND',
        ts: new Date().toISOString(),
        notification: {
          deliveryMode: 'IMMEDIATE',
          channel: form.channel === 'AUTO' ? undefined : form.channel,
          message: form.message,
          sourceId: form.sourceId,
          categoryId: form.categoryId || undefined,
          messageCategory: form.messageCategory,
          priorityClass: form.priorityClass,
          businessValue: form.businessValue,
          urgency: form.urgency,
          categoryDefaults,
          effectivePolicy,
          policyOverrides,
          metadata: form.subject ? { subject: form.subject } : undefined,
        },
      })
      setActionNotice('Immediate send event submitted.')
    } catch (err: any) {
      const status = err.response?.status
      const message = err.response?.data?.error || err.response?.data?.message || err.message || 'Immediate send failed'
      setError(status ? `HTTP ${status}: ${message}` : message)
    } finally {
      setLoading(null)
    }
  }

  const scorePosition = (value: number) => `${Math.min(100, Math.max(0, value * 10))}%`
  const probabilityPercent = (value?: number) =>
    typeof value === 'number' ? `${Math.round(value * 100)}%` : '-'

  const probabilityPointDelta = (recommended?: number, sendNow?: number) => {
    if (typeof recommended !== 'number' || typeof sendNow !== 'number') return null
    return Math.round((recommended - sendNow) * 100)
  }

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
                  ) : visibleRows.map((row) => (
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
            {rows.length > INITIAL_TABLE_ROWS && (
              <div className="px-5 py-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="text-xs text-slate-500">
                  Showing {visibleRows.length} of {rows.length} decisions
                </div>
                <button className="btn-secondary text-sm" onClick={() => setShowAllRows(!showAllRows)}>
                  {showAllRows ? 'Show 10' : 'Show all'}
                </button>
              </div>
            )}
          </div>

          <div className="card" id="attention-decision-form">
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
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Category Policy</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Select a configured category, then adjust scoring policy for this decision.
                    </div>
                  </div>
                  {selectedCategory && (
                    <span className={`badge ${overrideCount > 0 ? 'badge-warning text-nowrap' : 'badge-success'}`}>
                      {overrideCount > 0 ? `${overrideCount} override${overrideCount === 1 ? '' : 's'}` : 'Defaults'}
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="label">Configured Category</label>
                    <select
                      className="select"
                      value={form.categoryId}
                      onChange={(e) => applyCategory(e.target.value)}
                    >
                      <option value="">No category preset</option>
                      {notificationCategories.map((category) => (
                        <option key={category.categoryId} value={category.categoryId}>
                          {category.displayName || category.categoryId}
                        </option>
                      ))}
                    </select>
                    <div className="text-xs text-slate-500 mt-1">
                      {selectedCategory
                        ? `Category ID: ${selectedCategory.categoryId}`
                        : categoryLoadError || 'Optional: choose an organization category preset.'}
                    </div>
                  </div>

                  <div>
                    <label className="label">Message Category</label>
                    <select
                      className="select"
                      value={form.messageCategory}
                      disabled={Boolean(selectedCategory)}
                      onChange={(e) => setForm({ ...form, messageCategory: e.target.value as MessageCategory })}
                    >
                      {messageCategories.map((category) => <option key={category}>{category}</option>)}
                    </select>
                    {selectedCategory && (
                      <div className="text-xs text-slate-500 mt-1">
                        Locked to the configured category identity.
                      </div>
                    )}
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

                  {selectedCategory && (
                    <div className={`border rounded-lg p-3 text-sm ${overrideCount > 0 ? 'border-warning-200 bg-warning-50' : 'border-success-200 bg-success-50'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className={`font-semibold ${overrideCount > 0 ? 'text-warning-800' : 'text-success-800'}`}>
                            {overrideCount > 0 ? `${overrideCount} category override${overrideCount === 1 ? '' : 's'} active` : 'Using category defaults'}
                          </div>
                          <div className="text-xs text-slate-600 mt-1">
                            Stored in AttentionLedger for future training attribution.
                          </div>
                        </div>
                        <button
                          type="button"
                          className="btn-ghost text-xs"
                          onClick={() => setShowPolicyChanges(!showPolicyChanges)}
                        >
                          {showPolicyChanges ? 'Hide changes' : 'View changes'}
                        </button>
                      </div>
                      {showPolicyChanges && (
                        <div className="mt-3 space-y-2">
                          {categoryPolicyDiffs.map((row) => (
                            <div
                              key={row.key}
                              className={`rounded-md border px-3 py-2 ${row.changed ? 'border-warning-200 bg-white' : 'border-slate-200 bg-white/70'}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium text-slate-800">{row.label}</span>
                                <span className={`badge ${row.changed ? 'badge-warning' : 'badge-neutral'}`}>
                                  {row.changed ? 'Changed' : 'Default'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                                <div>
                                  <div className="text-slate-500">Category default</div>
                                  <div className="font-mono text-slate-800">{row.defaultValue}</div>
                                </div>
                                <div>
                                  <div className="text-slate-500">Current decision</div>
                                  <div className={`font-mono ${row.changed ? 'text-warning-800' : 'text-slate-800'}`}>{row.currentValue}</div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg p-3 bg-slate-50">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">Delivery Window</div>
                    <div className="text-xs text-slate-500 mt-0.5">Optimize only inside this local admin time range.</div>
                  </div>
                  <CalendarClock size={18} className="text-slate-500" />
                </div>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <button
                    type="button"
                    className={`btn-secondary text-xs justify-center ${deliveryWindow.preset === 'next24h' ? 'border-primary-300 bg-primary-50 text-primary-700' : ''}`}
                    onClick={() => applyWindowPreset('next24h')}
                  >
                    Next 24h
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary text-xs justify-center ${deliveryWindow.preset === 'next48h' ? 'border-primary-300 bg-primary-50 text-primary-700' : ''}`}
                    onClick={() => applyWindowPreset('next48h')}
                  >
                    Next 48h
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary text-xs justify-center ${deliveryWindow.preset === 'today' ? 'border-primary-300 bg-primary-50 text-primary-700' : ''}`}
                    onClick={() => applyWindowPreset('today')}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    className={`btn-secondary text-xs justify-center ${deliveryWindow.preset === 'tomorrow' ? 'border-primary-300 bg-primary-50 text-primary-700' : ''}`}
                    onClick={() => applyWindowPreset('tomorrow')}
                  >
                    Tomorrow
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="label">Window Start</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={deliveryWindow.start}
                      onChange={(e) => setDeliveryWindow({ ...deliveryWindow, start: e.target.value, preset: 'custom' })}
                    />
                    <div className="text-[11px] text-slate-500 mt-1">API UTC: {utcFromLocalInput(deliveryWindow.start)}</div>
                  </div>
                  <div>
                    <label className="label">Window End</label>
                    <input
                      type="datetime-local"
                      className="input"
                      value={deliveryWindow.end}
                      onChange={(e) => setDeliveryWindow({ ...deliveryWindow, end: e.target.value, preset: 'custom' })}
                    />
                    <div className="text-[11px] text-slate-500 mt-1">API UTC: {utcFromLocalInput(deliveryWindow.end)}</div>
                  </div>
                </div>
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

              <div className="grid grid-cols-1 gap-3">
                <button className="btn-primary" onClick={() => runDecision('preview')} disabled={loading !== null}>
                  {loading === 'preview' ? <Loader2 className="animate-spin" size={16} /> : <Clock size={16} />}
                  Preview
                </button>
              </div>
            </div>
          </div>
        </div>

        {result && (
          <div className="card-flush overflow-hidden scroll-mt-6" ref={resultRef}>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck size={18} className="text-primary-700" />
                <h3 className="font-semibold text-slate-900">Latest Decision Result</h3>
              </div>
              <div className={`px-4 py-2 rounded-lg border text-base font-bold tracking-wide ${decisionPanelClass(result.attentionDecision)}`}>
                {result.attentionDecision || 'UNKNOWN'}
              </div>
            </div>
            <div className={`px-5 py-5 border-b ${decisionPanelClass(result.attentionDecision)}`}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider opacity-75">Attention Decision</div>
                  <div className="text-4xl font-extrabold mt-1">{result.attentionDecision || 'UNKNOWN'}</div>
                </div>
                <div className="sm:text-right">
                  <div className="text-sm font-medium opacity-80">Value - Cost</div>
                  <div className="text-2xl font-bold">
                    {typeof result.attentionValue === 'number' && typeof result.attentionCost === 'number'
                      ? (result.attentionValue - result.attentionCost).toFixed(3)
                      : '-'}
                  </div>
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div>
                  <div className="font-semibold text-slate-900">
                    {result.attentionDecision === 'SEND'
                      ? 'This notification is cleared by Attention Escrow.'
                      : 'Attention Escrow recommends not sending this now.'}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    {result.attentionDecision === 'SEND'
                      ? 'Schedule the recommended time for best engagement, or send now if the business need is immediate.'
                      : 'You can still schedule this as a manual override while testing, or adjust inputs and preview again.'}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    className="btn-primary"
                    onClick={() => runDecision('schedule')}
                    disabled={loading !== null || result.scheduled}
                  >
                    {loading === 'schedule' ? <Loader2 className="animate-spin" size={16} /> : <CalendarClock size={16} />}
                    Schedule Recommended
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={sendNow}
                    disabled={loading !== null}
                  >
                    {loading === 'sendNow' ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                    Send Now
                  </button>
                  <button
                    className="btn-ghost"
                    onClick={() => document.getElementById('attention-decision-form')?.scrollIntoView({ behavior: 'smooth' })}
                    disabled={loading !== null}
                  >
                    <SlidersHorizontal size={16} />
                    Adjust
                  </button>
                </div>
              </div>
              {actionNotice && (
                <div className="mt-3 bg-success-50 border border-success-200 text-success-700 text-sm p-3 rounded-lg flex items-center gap-2">
                  <CheckCircle2 size={16} />
                  <span>{actionNotice}</span>
                </div>
              )}
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
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0 border-b border-slate-100">
              <div className="p-5 border-b md:border-b-0 md:border-r border-slate-100">
                <div className="text-xs text-slate-500">Best-hour click probability</div>
                <div className="text-2xl font-bold text-slate-900">{probabilityPercent(result.probability)}</div>
              </div>
              <div className="p-5 border-b md:border-b-0 md:border-r border-slate-100">
                <div className="text-xs text-slate-500">If sent now</div>
                <div className="text-2xl font-bold text-slate-900">{probabilityPercent(result.sendNowProbability)}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {result.sendNowTime
                    ? formatDateTime(result.sendNowTime)
                    : typeof result.sendNowHour === 'number'
                      ? `Current model hour: ${result.sendNowHour}:00 UTC`
                      : '-'}
                </div>
              </div>
              <div className="p-5">
                <div className="text-xs text-slate-500">Lift from waiting</div>
                <div className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                  <TrendingUp size={20} className="text-success-600" />
                  {probabilityPointDelta(result.probability, result.sendNowProbability) ?? '-'} pts
                </div>
              </div>
              <div className="p-5 border-t md:border-t-0 md:border-l border-slate-100">
                <div className="text-xs text-slate-500">Category overrides</div>
                <div className="text-2xl font-bold text-slate-900">{result.overrideCount ?? 0}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {result.categoryId ? result.categoryId : 'No configured category'}
                </div>
              </div>
            </div>
            <div className="p-5 border-b border-slate-100 bg-white">
              <div className="flex items-start gap-3">
                <div className="stat-icon-wrap bg-slate-100 flex-shrink-0">
                  <Send size={18} className="text-slate-700" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-slate-900">Send Now Impact</div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Send-now probability</div>
                      <div className="text-xl font-bold text-slate-900 mt-1">{probabilityPercent(result.sendNowProbability)}</div>
                      <div className="text-xs text-slate-500 mt-1">{result.sendNowTime ? formatDateTime(result.sendNowTime) : 'Current model hour'}</div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Recommended probability</div>
                      <div className="text-xl font-bold text-slate-900 mt-1">{probabilityPercent(result.probability)}</div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Timing penalty</div>
                      <div className="text-xl font-bold text-slate-900 mt-1">
                        {(() => {
                          const delta = probabilityPointDelta(result.probability, result.sendNowProbability)
                          if (delta === null) return '-'
                          if (delta <= 0) return '0 pts'
                          return `-${delta} pts`
                        })()}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="text-xs text-slate-500">Attention cost</div>
                      <div className="text-xl font-bold text-slate-900 mt-1">{result.attentionCost?.toFixed(3) ?? '-'}</div>
                    </div>
                  </div>
                  <div className="text-sm text-slate-600 mt-4">
                    {(() => {
                      const delta = probabilityPointDelta(result.probability, result.sendNowProbability)
                      if (result.attentionDecision === 'DEFER') {
                        return 'The API recommends deferring this notification; sending now may increase fatigue risk for this user.'
                      }
                      if (delta === null) {
                        return 'Send-now impact is based on the API decision response. Send-now probability was not returned for this result.'
                      }
                      if (delta <= 0) {
                        return 'No timing penalty is detected by the current model, so sending now and scheduling have similar predicted engagement.'
                      }
                      return `The model predicts scheduling may improve engagement by ${delta} percentage points compared with sending now.`
                    })()}
                  </div>
                </div>
              </div>
            </div>
            <div className="p-5">
              <div className="text-sm text-slate-600">{result.attentionReason}</div>
              <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden">
                <button
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 text-sm font-medium text-slate-700 flex items-center justify-between"
                  onClick={() => setShowDeveloperDetails(!showDeveloperDetails)}
                >
                  <span className="flex items-center gap-2">
                    <Code2 size={16} />
                    Developer details
                  </span>
                  <span>{showDeveloperDetails ? 'Hide' : 'Show'}</span>
                </button>
                {showDeveloperDetails && (
                  <pre className="p-4 bg-slate-950 text-slate-100 text-xs overflow-x-auto">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  )
}

export default Attention
