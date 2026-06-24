import { useEffect, useMemo, useState } from 'react'
import Layout from '@/components/common/Layout'
import { listCategories } from '@/api/categories'
import { previewBatchDecision } from '@/api/decisions'
import { ingestNotificationEvent } from '@/api/events'
import type {
  BatchDecisionResponse,
  DecisionResponse,
  MessageCategory,
  NotificationCategory,
  NotificationChannel,
  PriorityClass,
} from '@/types'
import {
  AlertCircle,
  BarChart3,
  Clock,
  Layers3,
  Loader2,
  Megaphone,
  ShieldCheck,
  Users,
  Send,
} from 'lucide-react'

const nowSeconds = () => Math.floor(Date.now() / 1000)

const uniqueUserIds = (raw: string) =>
  Array.from(
    new Set(
      raw
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )

const pct = (value?: number) => `${Math.round((value || 0) * 100)}%`

const timeLabel = (value?: string) => {
  if (!value) return 'N/A'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

const categoryDefaults = (category?: NotificationCategory) => {
  if (!category) return undefined
  return {
    categoryId: category.categoryId,
    channel: category.allowedChannels?.[0] || 'EMAIL',
    messageCategory: category.messageCategory,
    priorityClass: category.priorityClass,
    businessValue: category.businessValue,
    urgency: category.urgency,
    defaultDeliveryMode: category.defaultDeliveryMode,
    maxDelayHours: category.maxDelayHours,
  }
}

const Campaigns = () => {
  const [categories, setCategories] = useState<NotificationCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [campaignId, setCampaignId] = useState('pilot-campaign')
  const [categoryId, setCategoryId] = useState('')
  const [userIdsText, setUserIdsText] = useState('pilot_user_1\npilot_user_2\npilot_user_3')
  const [message, setMessage] = useState('A helpful reminder from your organization.')
  const [subject, setSubject] = useState('A helpful reminder')
  const [eventType, setEventType] = useState('CAMPAIGN_NOTIFICATION')
  const [channel, setChannel] = useState<NotificationChannel>('EMAIL')
  const [messageCategory, setMessageCategory] = useState<MessageCategory>('MARKETING')
  const [priorityClass, setPriorityClass] = useState<PriorityClass>('STANDARD')
  const [businessValue, setBusinessValue] = useState(6)
  const [urgency, setUrgency] = useState(0.4)
  const [maxDelayHours, setMaxDelayHours] = useState(24)
  const [preview, setPreview] = useState<BatchDecisionResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [launching, setLaunching] = useState<'IMMEDIATE' | 'OPTIMIZED' | null>(null)
  const [error, setError] = useState('')
  const [launchNotice, setLaunchNotice] = useState('')
  const [includeDeferred, setIncludeDeferred] = useState(false)

  const selectedCategory = categories.find((category) => category.categoryId === categoryId)
  const userIds = useMemo(() => uniqueUserIds(userIdsText), [userIdsText])
  const policyLocked = Boolean(selectedCategory)

  useEffect(() => {
    const loadCategories = async () => {
      setCategoriesLoading(true)
      try {
        const data = await listCategories()
        setCategories((data.categories || []).filter((category) => category.active !== false))
      } catch (err) {
        console.warn('Unable to load notification categories', err)
      } finally {
        setCategoriesLoading(false)
      }
    }
    loadCategories()
  }, [])

  const applyCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId)
    const category = categories.find((item) => item.categoryId === nextCategoryId)
    if (!category) return
    setChannel((category.allowedChannels?.[0] || 'EMAIL') as NotificationChannel)
    setMessageCategory(category.messageCategory)
    setPriorityClass(category.priorityClass)
    setBusinessValue(category.businessValue)
    setUrgency(category.urgency)
    setMaxDelayHours(category.defaultDeliveryMode === 'IMMEDIATE' ? 0 : category.maxDelayHours || 24)
  }

  const runPreview = async () => {
    setError('')
    setLaunchNotice('')
    setIncludeDeferred(false)
    setPreview(null)

    if (!campaignId.trim()) {
      setError('Campaign ID is required.')
      return
    }
    if (userIds.length === 0) {
      setError('Add at least one user ID.')
      return
    }
    if (userIds.length > 100) {
      setError('Batch preview supports up to 100 users for this MVP.')
      return
    }

    const start = nowSeconds()
    const delayHours = selectedCategory?.defaultDeliveryMode === 'IMMEDIATE' ? 1 : Math.max(1, maxDelayHours)
    const end = start + delayHours * 3600

    setLoading(true)
    try {
      const result = await previewBatchDecision({
        campaignId: campaignId.trim(),
        categoryId: selectedCategory?.categoryId,
        userIds,
        windowStart: start,
        windowEnd: end,
        channel,
        sourceId: `campaign:${campaignId.trim()}`,
        messageCategory,
        priorityClass,
        businessValue,
        urgency,
        message,
        categoryDefaults: categoryDefaults(selectedCategory),
        effectivePolicy: {
          categoryId: selectedCategory?.categoryId,
          channel,
          messageCategory,
          priorityClass,
          businessValue,
          urgency,
          maxDelayHours: delayHours,
        },
      })
      setPreview(result)
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to preview campaign batch.')
    } finally {
      setLoading(false)
    }
  }

  const sendReadyResults = useMemo(
    () => (preview?.results || []).filter((result) => result.status === 'PREVIEWED' && result.attentionDecision === 'SEND'),
    [preview]
  )
  const deferredResults = useMemo(
    () => (preview?.results || []).filter((result) => result.status === 'PREVIEWED' && result.attentionDecision === 'DEFER'),
    [preview]
  )
  const launchableResults = useMemo(
    () => (includeDeferred ? [...sendReadyResults, ...deferredResults] : sendReadyResults),
    [deferredResults, includeDeferred, sendReadyResults]
  )

  const buildEventPayload = (result: DecisionResponse, deliveryMode: 'IMMEDIATE' | 'OPTIMIZED') => {
    const notification: Record<string, unknown> = {
      deliveryMode,
      channel,
      message: message.trim(),
      sourceId: `campaign:${campaignId.trim()}`,
      campaignId: campaignId.trim(),
      messageCategory,
      priorityClass,
      businessValue,
      urgency,
      metadata: {
        subject: subject.trim(),
        campaignPreviewDecisionId: result.decisionId,
        recommendedSendTime: result.recommendedSendTime,
      },
    }

    if (selectedCategory?.categoryId) {
      notification.categoryId = selectedCategory.categoryId
    }
    if (deliveryMode === 'OPTIMIZED') {
      notification.maxDelayHours = selectedCategory?.defaultDeliveryMode === 'IMMEDIATE' ? 0 : maxDelayHours
    }

    return {
      userId: result.userId,
      type: eventType.trim() || 'CAMPAIGN_NOTIFICATION',
      ts: new Date().toISOString(),
      notification,
    }
  }

  const launchCampaign = async (deliveryMode: 'IMMEDIATE' | 'OPTIMIZED') => {
    setError('')
    setLaunchNotice('')

    if (!preview) {
      setError('Run a batch preview before launching.')
      return
    }
    if (launchableResults.length === 0) {
      setError('No launchable users are available from this preview.')
      return
    }
    if (deliveryMode === 'OPTIMIZED' && selectedCategory?.defaultDeliveryMode === 'IMMEDIATE') {
      setError('This category is immediate-only. Use Send now or choose an optimized category.')
      return
    }

    const confirmed = window.confirm(
      `${deliveryMode === 'IMMEDIATE' ? 'Send now' : 'Schedule'} ${launchableResults.length} user${launchableResults.length === 1 ? '' : 's'} from this preview?${includeDeferred && deferredResults.length > 0 ? ` This includes ${deferredResults.length} deferred user${deferredResults.length === 1 ? '' : 's'} that Attention Escrow recommended holding back.` : ' Deferred and missing users will be skipped.'}`
    )
    if (!confirmed) return

    setLaunching(deliveryMode)
    let accepted = 0
    let failed = 0

    for (const result of launchableResults) {
      try {
        await ingestNotificationEvent(buildEventPayload(result, deliveryMode))
        accepted += 1
      } catch (err) {
        console.warn('Campaign event failed', result.userId, err)
        failed += 1
      }
    }

    setLaunching(null)
    setLaunchNotice(
      `${deliveryMode === 'IMMEDIATE' ? 'Send-now' : 'Optimized schedule'} launch accepted ${accepted} event${accepted === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.${includeDeferred && deferredResults.length > 0 ? ` Included ${deferredResults.length} deferred user${deferredResults.length === 1 ? '' : 's'} by admin override.` : ''} Track scheduled decisions in Attention Escrow.`
    )
  }

  const stats = preview
    ? [
        { label: 'Recipients', value: preview.recipientCount, icon: Users },
        { label: 'Send-ready', value: preview.sendCount, icon: ShieldCheck },
        { label: 'Deferred', value: preview.deferCount, icon: Clock },
        { label: 'Not found', value: preview.notFoundCount, icon: AlertCircle },
      ]
    : [
        { label: 'Recipients', value: userIds.length, icon: Users },
        { label: 'Category', value: selectedCategory ? 1 : 0, icon: Layers3 },
        { label: 'Window hours', value: selectedCategory?.defaultDeliveryMode === 'IMMEDIATE' ? 1 : maxDelayHours, icon: Clock },
        { label: 'Preview only', value: 1, icon: BarChart3 },
      ]

  return (
    <Layout
      actions={
        <button className="btn-primary" onClick={runPreview} disabled={loading}>
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
          Preview batch
        </button>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((item) => (
            <div key={item.label} className="stat-card">
              <div className="stat-icon-wrap bg-primary-100">
                <item.icon size={18} className="text-primary-700" />
              </div>
              <div>
                <div className="text-xs text-slate-500">{item.label}</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{item.value}</div>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700 flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {launchNotice && (
          <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 flex items-start gap-2">
            <ShieldCheck size={16} className="mt-0.5 flex-shrink-0" />
            <span>{launchNotice}</span>
          </div>
        )}

        <div className="grid xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] gap-6">
          <section className="card-flush p-5 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Campaign draft</h2>
              <p className="text-sm text-slate-500 mt-1">
                Preview attention decisions for multiple users before sending anything.
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Campaign ID</label>
                <input className="input" value={campaignId} onChange={(event) => setCampaignId(event.target.value)} />
              </div>
              <div>
                <label className="label">Event type</label>
                <input className="input" value={eventType} onChange={(event) => setEventType(event.target.value)} />
              </div>
              <div>
                <label className="label">Subject</label>
                <input className="input" value={subject} onChange={(event) => setSubject(event.target.value)} />
              </div>
              <div>
                <label className="label">Configured category</label>
                <select
                  className="input"
                  value={categoryId}
                  onChange={(event) => applyCategory(event.target.value)}
                  disabled={categoriesLoading}
                >
                  <option value="">No category - manual policy</option>
                  {categories.map((category) => (
                    <option key={category.categoryId} value={category.categoryId}>
                      {category.displayName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">User IDs</label>
              <textarea
                className="input min-h-36 font-mono text-sm"
                value={userIdsText}
                onChange={(event) => setUserIdsText(event.target.value)}
                placeholder="One userId per line, or comma separated"
              />
              <div className="mt-1 text-xs text-slate-500">
                {userIds.length} unique user{userIds.length === 1 ? '' : 's'} parsed. MVP limit: 100.
              </div>
            </div>

            <div>
              <label className="label">Message</label>
              <textarea
                className="input min-h-20"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Message body used for preview context"
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="label">Channel</label>
                <select className="input" value={channel} onChange={(event) => setChannel(event.target.value as NotificationChannel)} disabled={policyLocked}>
                  <option value="EMAIL">Email</option>
                  <option value="SMS">SMS</option>
                  <option value="PUSH">Push</option>
                  <option value="AUTO">Auto</option>
                </select>
              </div>
              <div>
                <label className="label">Message category</label>
                <select className="input" value={messageCategory} onChange={(event) => setMessageCategory(event.target.value as MessageCategory)} disabled={policyLocked}>
                  <option value="MARKETING">Marketing</option>
                  <option value="TRANSACTIONAL">Transactional</option>
                  <option value="NEWSLETTER">Newsletter</option>
                  <option value="PROMOTION">Promotion</option>
                  <option value="GENERAL">General</option>
                  <option value="SECURITY">Security</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
              </div>
              <div>
                <label className="label">Priority</label>
                <select className="input" value={priorityClass} onChange={(event) => setPriorityClass(event.target.value as PriorityClass)} disabled={policyLocked}>
                  <option value="LOW">Low</option>
                  <option value="STANDARD">Standard</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="EMERGENCY">Emergency</option>
                </select>
              </div>
              <div>
                <label className="label">Delivery window</label>
                <select
                  className="input"
                  value={selectedCategory?.defaultDeliveryMode === 'IMMEDIATE' ? 1 : maxDelayHours}
                  onChange={(event) => setMaxDelayHours(Number(event.target.value))}
                  disabled={selectedCategory?.defaultDeliveryMode === 'IMMEDIATE'}
                >
                  <option value={1}>Send-now impact</option>
                  <option value={6}>Next 6 hours</option>
                  <option value={24}>Next 24 hours</option>
                  <option value={48}>Next 48 hours</option>
                </select>
              </div>
              <div>
                <label className="label">Business value</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={10}
                  step={0.5}
                  value={businessValue}
                  onChange={(event) => setBusinessValue(Number(event.target.value))}
                  disabled={policyLocked}
                />
              </div>
              <div>
                <label className="label">Urgency</label>
                <input
                  className="input"
                  type="number"
                  min={0}
                  max={1}
                  step={0.1}
                  value={urgency}
                  onChange={(event) => setUrgency(Number(event.target.value))}
                  disabled={policyLocked}
                />
              </div>
            </div>

            {selectedCategory && (
              <div className="rounded-lg border border-primary-100 bg-primary-50 px-4 py-3 text-sm text-primary-800">
                Category policy is locked for this preview. Edit the category if these defaults need to change.
              </div>
            )}
          </section>

          <section className="card-flush p-5 space-y-5">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Batch attention preview</h2>
              <p className="text-sm text-slate-500 mt-1">
                Preview does not schedule sends or write AttentionLedger decisions.
              </p>
            </div>

            {!preview ? (
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
                <ShieldCheck className="mx-auto text-slate-400" size={34} />
                <div className="mt-3 font-medium text-slate-800">No batch preview yet</div>
                <p className="mt-1 text-sm text-slate-500">
                  Add users and click Preview batch to see campaign-level attention impact.
                </p>
              </div>
            ) : (
              <>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Send rate</div>
                    <div className="text-xl font-bold text-slate-900">{pct(preview.sendRate)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Avg value / cost</div>
                    <div className="text-xl font-bold text-slate-900">
                      {preview.avgAttentionValue.toFixed(1)} / {preview.avgAttentionCost.toFixed(1)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs text-slate-500">Attention saved</div>
                    <div className="text-xl font-bold text-slate-900">{preview.estimatedAttentionSaved.toFixed(1)}</div>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-medium text-slate-900">Recommendation</div>
                <p className="text-sm text-slate-600 mt-1">{preview.recommendation}</p>
                  {preview.modelSource && (
                    <div className="mt-3 text-xs text-slate-500">
                      Model source: {preview.modelSource === 'FALLBACK_HEURISTIC' ? 'Startup heuristic' : 'SageMaker'} · {preview.modelConfidence}
                    </div>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-medium text-slate-900">Launch from preview</div>
                      <p className="text-sm text-slate-500 mt-1">
                        {launchableResults.length} user{launchableResults.length === 1 ? '' : 's'} will be submitted. Missing users stay untouched.
                      </p>
                      {deferredResults.length > 0 && (
                        <label className="mt-3 flex items-start gap-2 text-sm text-warning-700">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={includeDeferred}
                            onChange={(event) => setIncludeDeferred(event.target.checked)}
                          />
                          <span>
                            Include {deferredResults.length} deferred user{deferredResults.length === 1 ? '' : 's'}.
                            Attention Escrow recommended holding these back, so use this only for deliberate admin override.
                          </span>
                        </label>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        className="btn-secondary"
                        onClick={() => launchCampaign('IMMEDIATE')}
                        disabled={launching !== null || launchableResults.length === 0}
                      >
                        {launching === 'IMMEDIATE' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                        Send now
                      </button>
                      {selectedCategory?.defaultDeliveryMode !== 'IMMEDIATE' && (
                        <button
                          className="btn-primary"
                          onClick={() => launchCampaign('OPTIMIZED')}
                          disabled={launching !== null || launchableResults.length === 0}
                        >
                          {launching === 'OPTIMIZED' ? <Loader2 size={16} className="animate-spin" /> : <Clock size={16} />}
                          Schedule optimized
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Decision</th>
                        <th>Best time</th>
                        <th>Probability</th>
                        <th>Value / cost</th>
                        <th>Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.results.map((result) => (
                        <tr key={result.userId}>
                          <td className="font-mono text-xs">{result.userId}</td>
                          <td>
                            <span className={result.attentionDecision === 'SEND' ? 'badge badge-success' : result.status === 'USER_NOT_FOUND' ? 'badge badge-warning' : 'badge badge-neutral'}>
                              {result.status === 'USER_NOT_FOUND' ? 'Not found' : result.attentionDecision}
                            </span>
                          </td>
                          <td className="text-slate-600">{result.status === 'USER_NOT_FOUND' ? 'N/A' : timeLabel(result.recommendedSendTime)}</td>
                          <td>{result.status === 'USER_NOT_FOUND' ? 'N/A' : pct(result.probability)}</td>
                          <td>
                            {result.status === 'USER_NOT_FOUND'
                              ? 'N/A'
                              : `${(result.attentionValue || 0).toFixed(1)} / ${(result.attentionCost || 0).toFixed(1)}`}
                          </td>
                          <td className="text-slate-600 max-w-xs">{result.attentionReason}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </Layout>
  )
}

export default Campaigns
