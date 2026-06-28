import { useEffect, useMemo, useState } from 'react'
import Layout from '@/components/common/Layout'
import { createAudience, deleteAudience, listAudiences, updateAudience } from '@/api/audiences'
import { listCategories } from '@/api/categories'
import { createCampaign, deleteCampaign, listCampaigns, listCampaignLaunches, recordCampaignLaunch, updateCampaign } from '@/api/campaigns'
import { getAttentionSummary, previewBatchDecision } from '@/api/decisions'
import { ingestNotificationEvent } from '@/api/events'
import type {
  AttentionSummaryResponse,
  Audience,
  Campaign,
  BatchDecisionResponse,
  CampaignLaunch,
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
  Activity,
  Save,
  Trash2,
  Edit3,
  PlayCircle,
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

const campaignSourceId = (campaignId: string) => `campaign:${campaignId.trim()}`

const demoUserIds = [
  'pilot_user_1',
  'pilot_user_2',
  'pilot_user_3',
  'pilot_user_4',
  'pilot_user_5',
  'pilot_user_6',
]

const priorityClasses: PriorityClass[] = ['LOW', 'STANDARD', 'HIGH', 'URGENT', 'CRITICAL', 'EMERGENCY']

const normalizePriorityClass = (value?: string): PriorityClass => {
  const normalized = value?.trim().toUpperCase()
  if (normalized === 'TRANSACTIONAL') return 'STANDARD'
  return priorityClasses.includes(normalized as PriorityClass) ? normalized as PriorityClass : 'STANDARD'
}

const categoryDefaults = (category?: NotificationCategory) => {
  if (!category) return undefined
  return {
    categoryId: category.categoryId,
    channel: category.allowedChannels?.[0] || 'EMAIL',
    messageCategory: category.messageCategory,
    priorityClass: normalizePriorityClass(category.priorityClass),
    businessValue: category.businessValue,
    urgency: category.urgency,
    defaultDeliveryMode: category.defaultDeliveryMode,
    maxDelayHours: category.maxDelayHours,
  }
}

const normalizeError = (err: unknown) => {
  const maybe = err as { response?: { data?: { error?: string; message?: string }; status?: number }; message?: string }
  const apiMessage = maybe.response?.data?.error || maybe.response?.data?.message
  if (apiMessage && maybe.response?.status) return `${maybe.response.status}: ${apiMessage}`
  return apiMessage || maybe.message || 'Request failed'
}

const Campaigns = () => {
  const [categories, setCategories] = useState<NotificationCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [audiencesLoading, setAudiencesLoading] = useState(false)
  const [selectedAudienceId, setSelectedAudienceId] = useState('')
  const [audienceName, setAudienceName] = useState('Pilot Audience')
  const [audienceDescription, setAudienceDescription] = useState('')
  const [audienceModified, setAudienceModified] = useState(false)
  const [savingAudience, setSavingAudience] = useState(false)
  const [savedCampaigns, setSavedCampaigns] = useState<Campaign[]>([])
  const [campaignsLoading, setCampaignsLoading] = useState(false)
  const [selectedCampaignId, setSelectedCampaignId] = useState('')
  const [savingCampaign, setSavingCampaign] = useState(false)
  const [campaignId, setCampaignId] = useState('pilot-campaign')
  const [campaignName, setCampaignName] = useState('Pilot Campaign')
  const [campaignDescription, setCampaignDescription] = useState('')
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
  const [launches, setLaunches] = useState<CampaignLaunch[]>([])
  const [launchFilterCampaignId, setLaunchFilterCampaignId] = useState('')
  const [launchesLoading, setLaunchesLoading] = useState(false)
  const [outcomeLoadingSource, setOutcomeLoadingSource] = useState<string | null>(null)
  const [selectedOutcome, setSelectedOutcome] = useState<{
    title: string
    subtitle: string
    badge: string
    summary: AttentionSummaryResponse
  } | null>(null)

  const selectedCategory = categories.find((category) => category.categoryId === categoryId)
  const userIds = useMemo(() => uniqueUserIds(userIdsText), [userIdsText])
  const policyLocked = Boolean(selectedCategory)

  const loadCampaigns = async () => {
    setCampaignsLoading(true)
    try {
      const data = await listCampaigns()
      setSavedCampaigns(data.campaigns || [])
    } catch (err) {
      console.warn('Unable to load campaigns', err)
    } finally {
      setCampaignsLoading(false)
    }
  }

  const loadAudiences = async () => {
    setAudiencesLoading(true)
    try {
      const data = await listAudiences()
      setAudiences((data.audiences || []).filter((audience) => audience.active !== false))
    } catch (err) {
      console.warn('Unable to load audiences', err)
    } finally {
      setAudiencesLoading(false)
    }
  }

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
    loadCampaigns()
    loadAudiences()
  }, [])

  const loadLaunches = async (campaignIdFilter = launchFilterCampaignId) => {
    setLaunchesLoading(true)
    try {
      const data = await listCampaignLaunches({
        campaignId: campaignIdFilter || undefined,
        limit: 25,
      })
      setLaunches(data.launches || [])
      setLaunchFilterCampaignId(campaignIdFilter)
    } catch (err) {
      console.warn('Unable to load campaign launches', err)
    } finally {
      setLaunchesLoading(false)
    }
  }

  useEffect(() => {
    loadLaunches()
  }, [])

  const applyCategory = (nextCategoryId: string) => {
    setCategoryId(nextCategoryId)
    const category = categories.find((item) => item.categoryId === nextCategoryId)
    if (!category) return
    setChannel((category.allowedChannels?.[0] || 'EMAIL') as NotificationChannel)
    setMessageCategory(category.messageCategory)
    setPriorityClass(normalizePriorityClass(category.priorityClass))
    setBusinessValue(category.businessValue)
    setUrgency(category.urgency)
    setMaxDelayHours(category.defaultDeliveryMode === 'IMMEDIATE' ? 0 : category.maxDelayHours || 24)
  }

  const campaignPayload = (): Campaign => ({
    campaignId: campaignId.trim(),
    name: campaignName.trim(),
    description: campaignDescription.trim(),
    categoryId: selectedCategory?.categoryId || categoryId || undefined,
    eventType: eventType.trim() || 'CAMPAIGN_NOTIFICATION',
    subject: subject.trim(),
    message: message.trim(),
    channel,
    messageCategory,
    priorityClass: normalizePriorityClass(priorityClass),
    businessValue: Number(businessValue),
    urgency: Number(urgency),
    maxDelayHours: selectedCategory?.defaultDeliveryMode === 'IMMEDIATE' ? 0 : Number(maxDelayHours),
    defaultDeliveryMode: selectedCategory?.defaultDeliveryMode || 'OPTIMIZED',
    active: true,
  })

  const loadSavedCampaign = (campaign: Campaign) => {
    setSelectedCampaignId(campaign.campaignId)
    setCampaignId(campaign.campaignId)
    setCampaignName(campaign.name)
    setCampaignDescription(campaign.description || '')
    setCategoryId(campaign.categoryId || '')
    setEventType(campaign.eventType || 'CAMPAIGN_NOTIFICATION')
    setSubject(campaign.subject || '')
    setMessage(campaign.message)
    setChannel(campaign.channel)
    setMessageCategory(campaign.messageCategory)
    setPriorityClass(normalizePriorityClass(campaign.priorityClass))
    setBusinessValue(campaign.businessValue)
    setUrgency(campaign.urgency)
    setMaxDelayHours(campaign.defaultDeliveryMode === 'IMMEDIATE' ? 0 : campaign.maxDelayHours || 24)
    setPreview(null)
    setLaunchNotice('')
    setSelectedOutcome(null)
    setError('')
    loadLaunches(campaign.campaignId)
  }

  const saveCampaign = async () => {
    setError('')
    setLaunchNotice('')
    const payload = campaignPayload()
    if (!payload.campaignId) {
      setError('Campaign ID is required before saving.')
      return
    }
    if (!payload.name) {
      setError('Campaign name is required before saving.')
      return
    }
    if (!payload.message) {
      setError('Campaign message is required before saving.')
      return
    }

    setSavingCampaign(true)
    try {
      const exists = savedCampaigns.some((campaign) => campaign.campaignId === payload.campaignId)
      const saved = exists
        ? await updateCampaign(payload.campaignId, payload)
        : await createCampaign(payload)
      setSelectedCampaignId(saved.campaignId)
      await loadCampaigns()
      await loadLaunches(saved.campaignId)
      setLaunchNotice(exists ? 'Campaign updated.' : 'Campaign saved.')
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setSavingCampaign(false)
    }
  }

  const removeCampaign = async (campaign: Campaign) => {
    if (!window.confirm(`Delete saved campaign "${campaign.name}"? Launch history will remain.`)) return
    setError('')
    setLaunchNotice('')
    try {
      await deleteCampaign(campaign.campaignId)
      await loadCampaigns()
      if (selectedCampaignId === campaign.campaignId) {
        setSelectedCampaignId('')
        setLaunchFilterCampaignId('')
        await loadLaunches('')
      }
      setLaunchNotice('Campaign deleted. Existing launch history remains available.')
    } catch (err) {
      setError(normalizeError(err))
    }
  }

  const audiencePayload = (): Audience => ({
    audienceId: selectedAudienceId || audienceName.trim().toLowerCase().replace(/[^a-z0-9_.:-]+/g, '-').replace(/^-+|-+$/g, '') || 'audience',
    name: audienceName.trim(),
    description: audienceDescription.trim(),
    userIds,
    active: true,
  })

  const loadAudience = (audience: Audience) => {
    setSelectedAudienceId(audience.audienceId)
    setAudienceName(audience.name)
    setAudienceDescription(audience.description || '')
    setUserIdsText((audience.userIds || []).join('\n'))
    setAudienceModified(false)
    setPreview(null)
    setLaunchNotice('')
    setError('')
  }

  const saveAudience = async () => {
    setError('')
    setLaunchNotice('')
    const payload = audiencePayload()
    if (!payload.audienceId) {
      setError('Audience ID is required before saving.')
      return
    }
    if (!payload.name) {
      setError('Audience name is required before saving.')
      return
    }
    if (!payload.userIds.length) {
      setError('Add at least one user ID before saving an audience.')
      return
    }

    setSavingAudience(true)
    try {
      const exists = audiences.some((audience) => audience.audienceId === payload.audienceId)
      const saved = exists
        ? await updateAudience(payload.audienceId, payload)
        : await createAudience(payload)
      setSelectedAudienceId(saved.audienceId)
      setAudienceModified(false)
      await loadAudiences()
      setLaunchNotice(exists ? 'Audience updated.' : 'Audience saved.')
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setSavingAudience(false)
    }
  }

  const removeAudience = async (audience: Audience) => {
    if (!window.confirm(`Delete audience "${audience.name}"? Campaign launch history will remain.`)) return
    setError('')
    setLaunchNotice('')
    try {
      await deleteAudience(audience.audienceId)
      await loadAudiences()
      if (selectedAudienceId === audience.audienceId) {
        setSelectedAudienceId('')
        setAudienceModified(false)
      }
      setLaunchNotice('Audience deleted. Existing campaign launch history remains available.')
    } catch (err) {
      setError(normalizeError(err))
    }
  }

  const loadDemoScenario = () => {
    setSelectedCampaignId('')
    setCampaignId('demo-public-health-reminder')
    setCampaignName('Demo Public Health Reminder')
    setCampaignDescription('Demo scenario for appointment reminders and community outreach messages.')
    setCategoryId('')
    setEventType('PUBLIC_HEALTH_REMINDER')
    setSubject('Reminder: please review your appointment details')
    setMessage('This is a helpful reminder from your public health team. Please review your appointment details or outreach instructions when convenient.')
    setChannel('EMAIL')
    setMessageCategory('TRANSACTIONAL')
    setPriorityClass('STANDARD')
    setBusinessValue(7)
    setUrgency(0.5)
    setMaxDelayHours(24)
    setSelectedAudienceId('demo-public-health-pilot')
    setAudienceName('Demo Public Health Pilot')
    setAudienceDescription('Demo audience used for a public health reminder walkthrough.')
    setUserIdsText(demoUserIds.join('\n'))
    setAudienceModified(false)
    setPreview(null)
    setSelectedOutcome(null)
    setIncludeDeferred(false)
    setError('')
    setLaunchNotice('Demo loaded. Click Preview batch to see who should receive now, who should wait, and why.')
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
        sourceId: campaignSourceId(campaignId),
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
          priorityClass: normalizePriorityClass(priorityClass),
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
      sourceId: campaignSourceId(campaignId),
      campaignId: campaignId.trim(),
      messageCategory,
      priorityClass: normalizePriorityClass(priorityClass),
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

    try {
      const launch = await recordCampaignLaunch({
        campaignId: campaignId.trim(),
        categoryId: selectedCategory?.categoryId,
        audienceId: selectedAudienceId && !audienceModified ? selectedAudienceId : undefined,
        sourceId: preview.sourceId,
        deliveryMode,
        recipientCount: preview.recipientCount,
        previewedCount: preview.previewedCount,
        sendReadyCount: sendReadyResults.length,
        deferredCount: deferredResults.length,
        deferredIncludedCount: includeDeferred ? deferredResults.length : 0,
        notFoundSkippedCount: preview.notFoundCount,
        acceptedCount: accepted,
        failedCount: failed,
        avgAttentionCost: preview.avgAttentionCost,
        avgAttentionValue: preview.avgAttentionValue,
        avgFatigueScore: preview.avgFatigueScore,
        avgProbability: preview.avgProbability,
        estimatedAttentionSaved: preview.estimatedAttentionSaved,
        modelSource: preview.modelSource,
        modelConfidence: preview.modelConfidence,
        recommendation: preview.recommendation,
      })
      setLaunches((items) => [launch, ...items].slice(0, 10))
      setLaunchFilterCampaignId(campaignId.trim())
    } catch (err) {
      console.warn('Unable to record campaign launch', err)
      setError('Launch submitted, but launch history could not be recorded.')
    }

    setLaunching(null)
    setLaunchNotice(
      `${deliveryMode === 'IMMEDIATE' ? 'Send-now' : 'Optimized schedule'} launch accepted ${accepted} event${accepted === 1 ? '' : 's'}${failed ? `, ${failed} failed` : ''}.${includeDeferred && deferredResults.length > 0 ? ` Included ${deferredResults.length} deferred user${deferredResults.length === 1 ? '' : 's'} by admin override.` : ''} Track scheduled decisions in Attention Escrow.`
    )
  }

  const loadLaunchOutcome = async (launch: CampaignLaunch) => {
    const sourceId = launch.sourceId || campaignSourceId(launch.campaignId)
    setOutcomeLoadingSource(sourceId)
    setError('')
    try {
      const summary = await getAttentionSummary({ sourceId, limit: 200 })
      setSelectedOutcome({
        title: `${launch.campaignId} overall`,
        subtitle: `${sourceId} · includes all launches using this campaign source`,
        badge: 'Campaign summary',
        summary,
      })
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to load campaign outcome summary.')
    } finally {
      setOutcomeLoadingSource(null)
    }
  }

  const loadCampaignOutcome = async (campaign: Campaign) => {
    const sourceId = campaignSourceId(campaign.campaignId)
    setOutcomeLoadingSource(sourceId)
    setError('')
    try {
      const summary = await getAttentionSummary({ sourceId, limit: 500 })
      setSelectedOutcome({
        title: `${campaign.name} overall`,
        subtitle: `${sourceId} · all launches for ${campaign.campaignId}`,
        badge: 'Campaign summary',
        summary,
      })
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || err.message || 'Unable to load campaign outcome summary.')
    } finally {
      setOutcomeLoadingSource(null)
    }
  }

  const stats = preview
    ? [
        { label: 'Recipients', value: preview.recipientCount, icon: Users },
        { label: 'Send-ready', value: preview.sendCount, icon: ShieldCheck },
        { label: 'Deferred', value: preview.deferCount, icon: Clock },
        { label: 'Launchable', value: launchableResults.length, icon: Send },
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
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={loadDemoScenario} disabled={loading || launching !== null}>
            <PlayCircle size={16} />
            Load demo
          </button>
          <button className="btn-primary" onClick={runPreview} disabled={loading}>
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Megaphone size={16} />}
            Preview batch
          </button>
        </div>
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

        <section className="card-flush">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Campaign library</h2>
              <p className="text-sm text-slate-500 mt-1">
                Save reusable campaign settings, then load them later for another preview or launch.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={loadCampaigns} disabled={campaignsLoading}>
                {campaignsLoading ? <Loader2 size={16} className="animate-spin" /> : <BarChart3 size={16} />}
                Refresh
              </button>
              <button className="btn-primary" onClick={saveCampaign} disabled={savingCampaign}>
                {savingCampaign ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {savedCampaigns.some((campaign) => campaign.campaignId === campaignId.trim()) ? 'Update campaign' : 'Save campaign'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Category</th>
                  <th>Mode</th>
                  <th>Priority</th>
                  <th>Value / urgency</th>
                  <th className="text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody>
                {savedCampaigns.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center text-slate-500 py-8">
                      {campaignsLoading ? 'Loading campaigns...' : 'No saved campaigns yet. Save the draft below to reuse it later.'}
                    </td>
                  </tr>
                ) : (
                  savedCampaigns.map((campaign) => (
                    <tr key={campaign.campaignId} className={selectedCampaignId === campaign.campaignId ? 'bg-primary-50/60' : ''}>
                      <td>
                        <div className="font-medium text-slate-900">{campaign.name}</div>
                        <div className="text-xs text-slate-400 font-mono">{campaign.campaignId}</div>
                      </td>
                      <td>{campaign.categoryId || 'Manual policy'}</td>
                      <td>
                        <span className={campaign.defaultDeliveryMode === 'IMMEDIATE' ? 'badge badge-info' : 'badge badge-success'}>
                          {campaign.defaultDeliveryMode === 'IMMEDIATE' ? 'Immediate' : 'Optimized'}
                        </span>
                      </td>
                      <td>{campaign.priorityClass}</td>
                      <td>{campaign.businessValue.toFixed(1)} / {campaign.urgency.toFixed(1)}</td>
                      <td className="text-right pr-6">
                        <div className="flex justify-end gap-2">
                          <button className="btn-secondary text-xs" onClick={() => loadSavedCampaign(campaign)}>
                            <Edit3 size={14} />
                            Load
                          </button>
                          <button
                            className="btn-secondary text-xs"
                            onClick={() => loadCampaignOutcome(campaign)}
                            disabled={outcomeLoadingSource === campaignSourceId(campaign.campaignId)}
                          >
                            {outcomeLoadingSource === campaignSourceId(campaign.campaignId)
                              ? <Loader2 size={14} className="animate-spin" />
                              : <Activity size={14} />}
                            Outcome
                          </button>
                          <button className="btn-secondary text-xs text-danger-700" onClick={() => removeCampaign(campaign)}>
                            <Trash2 size={14} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="card-flush">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Audience library</h2>
              <p className="text-sm text-slate-500 mt-1">
                Save reusable recipient lists and load them into the campaign draft.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary" onClick={loadAudiences} disabled={audiencesLoading}>
                {audiencesLoading ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
                Refresh
              </button>
              <button className="btn-primary" onClick={saveAudience} disabled={savingAudience}>
                {savingAudience ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {selectedAudienceId && audiences.some((audience) => audience.audienceId === selectedAudienceId) ? 'Update audience' : 'Save audience'}
              </button>
            </div>
          </div>

          <div className="grid xl:grid-cols-[minmax(0,1fr)_360px] gap-5 p-5">
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Audience</th>
                    <th>Users</th>
                    <th>Updated</th>
                    <th className="text-right pr-6">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {audiences.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-slate-500 py-8">
                        {audiencesLoading ? 'Loading audiences...' : 'No saved audiences yet. Save the current user IDs to reuse them later.'}
                      </td>
                    </tr>
                  ) : (
                    audiences.map((audience) => (
                      <tr key={audience.audienceId} className={selectedAudienceId === audience.audienceId ? 'bg-primary-50/60' : ''}>
                        <td>
                          <div className="font-medium text-slate-900">{audience.name}</div>
                          <div className="text-xs text-slate-400 font-mono">{audience.audienceId}</div>
                        </td>
                        <td>{audience.userIds?.length || 0}</td>
                        <td className="text-slate-600">{timeLabel(audience.updatedAt || audience.createdAt)}</td>
                        <td className="text-right pr-6">
                          <div className="flex justify-end gap-2">
                            <button className="btn-secondary text-xs" onClick={() => loadAudience(audience)}>
                              <Edit3 size={14} />
                              Load
                            </button>
                            <button className="btn-secondary text-xs text-danger-700" onClick={() => removeAudience(audience)}>
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Audience name</label>
                <input className="input" value={audienceName} onChange={(event) => setAudienceName(event.target.value)} />
              </div>
              <div>
                <label className="label">Selected audience ID</label>
                <input
                  className="input"
                value={selectedAudienceId}
                  onChange={(event) => {
                    setSelectedAudienceId(event.target.value)
                    setAudienceModified(false)
                  }}
                  placeholder="Auto-created from name if blank"
                />
              </div>
              <div>
                <label className="label">Audience notes</label>
                <textarea
                  className="input min-h-20"
                  value={audienceDescription}
                  onChange={(event) => setAudienceDescription(event.target.value)}
                  placeholder="Optional internal notes"
                />
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                Saving uses the user IDs currently in the campaign draft. Loading an audience replaces the user IDs box, and you can still edit before preview.
              </div>
            </div>
          </div>
        </section>

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
                <label className="label">Campaign name</label>
                <input className="input" value={campaignName} onChange={(event) => setCampaignName(event.target.value)} />
              </div>
              <div>
                <label className="label">Campaign ID</label>
                <input
                  className="input"
                  value={campaignId}
                  onChange={(event) => {
                    setCampaignId(event.target.value)
                    setSelectedCampaignId('')
                  }}
                />
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
              <label className="label">Internal description</label>
              <textarea
                className="input min-h-16"
                value={campaignDescription}
                onChange={(event) => setCampaignDescription(event.target.value)}
                placeholder="Optional notes for admins. Not sent to users."
              />
            </div>

            <div>
              <label className="label">User IDs</label>
              <textarea
                className="input min-h-36 font-mono text-sm"
                value={userIdsText}
                onChange={(event) => {
                  setUserIdsText(event.target.value)
                  if (selectedAudienceId) setAudienceModified(true)
                  setPreview(null)
                }}
                placeholder="One userId per line, or comma separated"
              />
              <div className="mt-1 text-xs text-slate-500">
                {userIds.length} unique user{userIds.length === 1 ? '' : 's'} parsed. MVP preview limit: 100.
                {selectedAudienceId
                  ? audienceModified
                    ? ` Loaded audience ${selectedAudienceId} has unsaved recipient edits; launch history will record this as manual unless you save the audience.`
                    : ` Loaded audience: ${selectedAudienceId}.`
                  : ''}
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

        <section className="card-flush">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Recent launches</h2>
              <p className="text-sm text-slate-500 mt-1">
                {launchFilterCampaignId
                  ? `Showing launches for ${launchFilterCampaignId}.`
                  : 'Launch history is recorded after campaign events are submitted.'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {launchFilterCampaignId && (
                <button className="btn-secondary" onClick={() => loadLaunches('')} disabled={launchesLoading}>
                  Show all
                </button>
              )}
              <button className="btn-secondary" onClick={() => loadLaunches()} disabled={launchesLoading}>
                {launchesLoading ? <Loader2 size={16} className="animate-spin" /> : <BarChart3 size={16} />}
                Refresh
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Audience</th>
                  <th>Mode</th>
                  <th>Accepted</th>
                  <th>Deferred override</th>
                  <th>Skipped</th>
                  <th>Avg value / cost</th>
                  <th>Created</th>
                  <th className="text-right pr-6">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {launches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-slate-500 py-8">
                      {launchesLoading ? 'Loading launch history...' : 'No campaign launches recorded yet.'}
                    </td>
                  </tr>
                ) : (
                  launches.map((launch) => (
                    <tr key={launch.launchId}>
                      <td>
                        <div className="font-medium text-slate-900">{launch.campaignId}</div>
                        <div className="text-xs text-slate-400 font-mono">{launch.launchId}</div>
                      </td>
                      <td>{launch.audienceId || 'Manual'}</td>
                      <td>
                        <span className={launch.deliveryMode === 'IMMEDIATE' ? 'badge badge-info' : 'badge badge-success'}>
                          {launch.deliveryMode === 'IMMEDIATE' ? 'Send now' : 'Optimized'}
                        </span>
                      </td>
                      <td>
                        <span className="font-medium text-slate-900">{launch.acceptedCount}</span>
                        {launch.failedCount > 0 && <span className="text-danger-600"> / {launch.failedCount} failed</span>}
                      </td>
                      <td>{launch.deferredIncludedCount || 0}</td>
                      <td>{launch.notFoundSkippedCount || 0}</td>
                      <td>
                        {(launch.avgAttentionValue || 0).toFixed(1)} / {(launch.avgAttentionCost || 0).toFixed(1)}
                      </td>
                      <td className="text-slate-600">{timeLabel(launch.createdAt)}</td>
                      <td className="text-right pr-6">
                        <button
                          className="btn-secondary text-xs"
                          onClick={() => loadLaunchOutcome(launch)}
                          disabled={outcomeLoadingSource === (launch.sourceId || campaignSourceId(launch.campaignId))}
                        >
                          {outcomeLoadingSource === (launch.sourceId || campaignSourceId(launch.campaignId))
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Activity size={14} />}
                          View
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {selectedOutcome && (
          <section className="card-flush p-5 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Campaign outcome snapshot</h2>
                <p className="text-sm text-slate-500 mt-1">
                  {selectedOutcome.title} · {selectedOutcome.subtitle}
                </p>
              </div>
              <span className="badge badge-info">{selectedOutcome.badge}</span>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="text-xs text-slate-500">Decisions</div>
                <div className="text-2xl font-bold text-slate-900">{selectedOutcome.summary.totalDecisions}</div>
                <div className="text-xs text-slate-500 mt-1">Send rate {pct(selectedOutcome.summary.sendRate)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="text-xs text-slate-500">Deferred</div>
                <div className="text-2xl font-bold text-slate-900">{selectedOutcome.summary.deferredDecisions}</div>
                <div className="text-xs text-slate-500 mt-1">Attention saved {selectedOutcome.summary.estimatedAttentionSaved.toFixed(1)}</div>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="text-xs text-slate-500">Deliveries</div>
                <div className="text-2xl font-bold text-slate-900">{selectedOutcome.summary.deliveryRecords || 0}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Sent {selectedOutcome.summary.sentDeliveries || 0}, failed {selectedOutcome.summary.failedDeliveries || 0}
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="text-xs text-slate-500">Avg value / cost</div>
                <div className="text-2xl font-bold text-slate-900">
                  {selectedOutcome.summary.avgAttentionValue.toFixed(1)} / {selectedOutcome.summary.avgAttentionCost.toFixed(1)}
                </div>
                <div className="text-xs text-slate-500 mt-1">Fatigue {selectedOutcome.summary.avgFatigueScore.toFixed(2)}</div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              {selectedOutcome.summary.recommendation}
            </div>
          </section>
        )}
      </div>
    </Layout>
  )
}

export default Campaigns
