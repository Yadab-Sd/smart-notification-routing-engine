import { useEffect, useMemo, useState } from 'react'
import Layout from '@/components/common/Layout'
import {
  AlertCircle,
  Bell,
  CheckCircle,
  Copy,
  FileText,
  Loader2,
  Layers3,
  Mail,
  MessageSquare,
  Send,
  ShieldCheck,
  X,
  Zap,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ENV } from '@/config/env'
import { listCategories } from '@/api/categories'
import { listTemplates } from '@/api/templates'
import type { MessageCategory, NotificationCategory, NotificationTemplate, PriorityClass } from '@/types'
import { compactTemplateVariables, templateVariableNames } from '@/utils/template-variables'

const API_ENDPOINT = ENV.API_URL

type DeliveryMode = 'ANALYTICS_ONLY' | 'IMMEDIATE' | 'OPTIMIZED'
type Channel = 'EMAIL' | 'SMS' | 'PUSH'

interface EventLog {
  id: string
  userId: string
  type: string
  deliveryMode: DeliveryMode
  channel?: Channel
  status: 'success' | 'error'
  timestamp: string
  message?: string
  error?: string
}

const categoryOptions: MessageCategory[] = [
  'GENERAL',
  'MARKETING',
  'PROMOTION',
  'NEWSLETTER',
  'TRANSACTIONAL',
  'SECURITY',
  'EMERGENCY',
]

const priorityOptions: PriorityClass[] = [
  'LOW',
  'STANDARD',
  'HIGH',
  'URGENT',
  'CRITICAL',
  'EMERGENCY',
]

const Events = () => {
  const { getIdToken } = useAuth()
  const [sending, setSending] = useState(false)
  const [eventLogs, setEventLogs] = useState<EventLog[]>([])
  const [categories, setCategories] = useState<NotificationCategory[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({})
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState({
    categoryId: '',
    userId: 'pilot_user_1',
    email: '',
    phone: '',
    type: 'ABANDONED_CART',
    deliveryMode: 'OPTIMIZED' as DeliveryMode,
    channel: 'EMAIL' as Channel,
    message: 'You left something in your cart.',
    subject: 'Complete your order',
    sourceId: 'campaign:abandoned_cart',
    campaignId: 'abandoned_cart',
    templateId: 'cart_reminder_v1',
    messageCategory: 'MARKETING' as MessageCategory,
    priorityClass: 'LOW' as PriorityClass,
    businessValue: 6,
    urgency: 0.3,
    maxDelayHours: 24,
  })

  const shouldSendNotification = formData.deliveryMode !== 'ANALYTICS_ONLY'
  const isOptimized = formData.deliveryMode === 'OPTIMIZED'
  const selectedCategory = categories.find((category) => category.categoryId === formData.categoryId)
  const selectedTemplate = templates.find((template) => template.templateId === formData.templateId)
  const selectedTemplateVariables = useMemo(() => templateVariableNames(selectedTemplate), [selectedTemplate])
  const selectableChannels = useMemo(() => {
    const categoryChannels = selectedCategory?.allowedChannels?.filter((channel) => channel !== 'AUTO') as Channel[] | undefined
    return categoryChannels && categoryChannels.length > 0 ? categoryChannels : (['EMAIL', 'SMS', 'PUSH'] as Channel[])
  }, [selectedCategory])

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
    const loadTemplates = async () => {
      setTemplatesLoading(true)
      try {
        const data = await listTemplates()
        setTemplates((data.templates || []).filter((template) => template.active !== false))
      } catch (err) {
        console.warn('Unable to load templates', err)
      } finally {
        setTemplatesLoading(false)
      }
    }
    loadCategories()
    loadTemplates()
  }, [])

  const applyCategory = (categoryId: string) => {
    const category = categories.find((item) => item.categoryId === categoryId)
    if (!category) {
      setFormData({ ...formData, categoryId })
      return
    }

    const allowedChannels = category.allowedChannels?.filter((channel) => channel !== 'AUTO') as Channel[] | undefined
    const nextChannel = allowedChannels?.includes(formData.channel)
      ? formData.channel
      : allowedChannels?.[0] || formData.channel

    setFormData({
      ...formData,
      categoryId,
      deliveryMode: category.defaultDeliveryMode,
      channel: nextChannel,
      messageCategory: category.messageCategory,
      priorityClass: category.priorityClass,
      businessValue: category.businessValue,
      urgency: category.urgency,
      maxDelayHours: category.maxDelayHours,
      sourceId: formData.sourceId || `category:${category.categoryId}`,
    })
  }

  const applyTemplate = (templateId: string) => {
    const template = templates.find((item) => item.templateId === templateId)
    if (!template) {
      setFormData({ ...formData, templateId })
      setTemplateVariables({})
      return
    }

    const variableNames = templateVariableNames(template)
    setTemplateVariables((current) => Object.fromEntries(variableNames.map((name) => [name, current[name] || ''])))
    setFormData({
      ...formData,
      templateId,
      subject: template.subject || formData.subject,
      message: template.body,
      channel: selectedCategory ? formData.channel : template.channel as Channel,
      messageCategory: selectedCategory ? formData.messageCategory : template.messageCategory,
    })
  }

  const eventPayload = useMemo(() => {
    const payload: Record<string, unknown> = {
      userId: formData.userId.trim(),
      type: formData.type.trim() || 'CUSTOM',
      ts: new Date().toISOString(),
    }

    if (formData.email.trim()) payload.email = formData.email.trim()
    if (formData.phone.trim()) payload.phone = formData.phone.trim()

    if (shouldSendNotification) {
      const notification: Record<string, unknown> = {
        deliveryMode: formData.deliveryMode,
        channel: formData.channel,
        message: formData.message.trim(),
      }
      if (formData.categoryId.trim()) notification.categoryId = formData.categoryId.trim()
      if (formData.templateId.trim()) notification.templateId = formData.templateId.trim()

      const metadata: Record<string, unknown> = {}
      if (formData.subject.trim()) metadata.subject = formData.subject.trim()
      const variables = compactTemplateVariables(templateVariables)
      if (Object.keys(variables).length > 0) metadata.templateVariables = variables
      if (Object.keys(metadata).length > 0) notification.metadata = metadata

      if (isOptimized) {
        if (formData.sourceId.trim()) notification.sourceId = formData.sourceId.trim()
        if (formData.campaignId.trim()) notification.campaignId = formData.campaignId.trim()
        notification.messageCategory = formData.messageCategory
        notification.priorityClass = formData.priorityClass
        notification.businessValue = Number(formData.businessValue)
        notification.urgency = Number(formData.urgency)
        notification.maxDelayHours = Number(formData.maxDelayHours)
      }

      payload.notification = notification
    }

    return payload
  }, [formData, isOptimized, shouldSendNotification, templateVariables])

  const resetForm = () => {
    setFormData({
      userId: '',
      categoryId: '',
      email: '',
      phone: '',
      type: 'NOTIFICATION',
      deliveryMode: 'IMMEDIATE',
      channel: 'EMAIL',
      message: '',
      subject: '',
      sourceId: '',
      campaignId: '',
      templateId: '',
      messageCategory: 'GENERAL',
      priorityClass: 'STANDARD',
      businessValue: 1,
      urgency: 0.3,
      maxDelayHours: 24,
    })
    setTemplateVariables({})
  }

  const handleSendEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)

    try {
      const token = await getIdToken()

      const res = await fetch(`${API_ENDPOINT}/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(eventPayload),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to send event')
      }

      const newLog: EventLog = {
        id: Date.now().toString(),
        userId: formData.userId,
        type: formData.type,
        deliveryMode: formData.deliveryMode,
        channel: shouldSendNotification ? formData.channel : undefined,
        status: 'success',
        timestamp: new Date().toISOString(),
        message: formData.message.substring(0, 60) + (formData.message.length > 60 ? '...' : ''),
      }
      setEventLogs((logs) => [newLog, ...logs])
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)
    } catch (err: any) {
      const newLog: EventLog = {
        id: Date.now().toString(),
        userId: formData.userId,
        type: formData.type,
        deliveryMode: formData.deliveryMode,
        channel: shouldSendNotification ? formData.channel : undefined,
        status: 'error',
        timestamp: new Date().toISOString(),
        error: err.message,
      }
      setEventLogs((logs) => [newLog, ...logs])
      setError(err.message || 'Failed to send event')
    } finally {
      setSending(false)
    }
  }

  const channelIcon = (channel?: Channel) => {
    if (channel === 'EMAIL') return Mail
    if (channel === 'SMS') return MessageSquare
    return Bell
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }

  const copyPayload = async () => {
    await navigator.clipboard.writeText(JSON.stringify(eventPayload, null, 2))
  }

  return (
    <Layout
      actions={
        <button
          className="btn-primary"
          onClick={() => document.getElementById('event-form')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <Send size={16} /> Send Event
        </button>
      }
    >
      <div className="space-y-6">
        {showSuccess && (
          <div className="bg-success-50 border border-success-200 text-success-700 p-4 rounded-lg flex items-center gap-3">
            <CheckCircle size={20} />
            <span className="font-medium">Event accepted. Optimized sends can be tracked in Attention Escrow.</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            type="button"
            className={`card text-left transition ${formData.deliveryMode === 'ANALYTICS_ONLY' ? 'border-primary-300 bg-primary-50' : 'hover:border-slate-300'}`}
            onClick={() => setFormData({ ...formData, deliveryMode: 'ANALYTICS_ONLY' })}
            disabled={sending}
          >
            <div className="flex items-start gap-3">
              <div className="stat-icon-wrap bg-slate-100">
                <Bell size={18} className="text-slate-600" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">Analytics Only</div>
                <div className="text-sm text-slate-500 mt-1">Track behavior without sending a message</div>
              </div>
            </div>
          </button>
          <button
            type="button"
            className={`card text-left transition ${formData.deliveryMode === 'IMMEDIATE' ? 'border-danger-300 bg-danger-50' : 'hover:border-slate-300'}`}
            onClick={() => setFormData({ ...formData, deliveryMode: 'IMMEDIATE' })}
            disabled={sending}
          >
            <div className="flex items-start gap-3">
              <div className="stat-icon-wrap bg-danger-100">
                <Zap size={18} className="text-danger-700" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">Immediate</div>
                <div className="text-sm text-slate-500 mt-1">Invoke Sender Service now</div>
              </div>
            </div>
          </button>
          <button
            type="button"
            className={`card text-left transition ${formData.deliveryMode === 'OPTIMIZED' ? 'border-primary-300 bg-primary-50' : 'hover:border-slate-300'}`}
            onClick={() => setFormData({ ...formData, deliveryMode: 'OPTIMIZED' })}
            disabled={sending}
          >
            <div className="flex items-start gap-3">
              <div className="stat-icon-wrap bg-primary-100">
                <ShieldCheck size={18} className="text-primary-700" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">Optimized</div>
                <div className="text-sm text-slate-500 mt-1">Run send-time ML and Attention Escrow</div>
              </div>
            </div>
          </button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
          <div className="card" id="event-form">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Send Event</h3>
                <p className="text-sm text-slate-500 mt-1">Create an event, optionally attach a notification, and submit it to the routing engine.</p>
              </div>
              <span className="badge badge-info">{formData.deliveryMode}</span>
            </div>

            <form onSubmit={handleSendEvent} className="space-y-5">
              <div className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Layers3 size={18} className="text-slate-600" />
                  <h4 className="font-semibold text-slate-900">Event Identity</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="label">
                      User ID <span className="text-danger-600">*</span>
                    </label>
                    <input
                      type="text"
                      className="input"
                      placeholder="pilot_user_1"
                      value={formData.userId}
                      onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                      disabled={sending}
                      required
                    />
                  </div>

                  <div>
                    <label className="label">Event Type</label>
                    <input
                      className="input"
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value.toUpperCase() })}
                      disabled={sending}
                      placeholder="ABANDONED_CART"
                    />
                  </div>

                  <div>
                    <label className="label">Email</label>
                    <input
                      type="email"
                      className="input"
                      placeholder="user@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      disabled={sending}
                    />
                    <p className="text-xs text-slate-500 mt-1">Useful when auto-creating a user.</p>
                  </div>

                  <div>
                    <label className="label">Phone</label>
                    <input
                      type="tel"
                      className="input"
                      placeholder="+14155551234"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      disabled={sending}
                    />
                  </div>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <Send size={18} className="text-slate-600" />
                    <h4 className="font-semibold text-slate-900">Notification</h4>
                  </div>
                  <span className={`badge ${shouldSendNotification ? 'badge-info' : 'badge-neutral'}`}>
                    {shouldSendNotification ? formData.deliveryMode : 'No send'}
                  </span>
                </div>

                {!shouldSendNotification ? (
                  <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    This mode records the event for analytics only. No `notification` object will be sent to the API.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Category Policy</label>
                        <select
                          className="select"
                          value={formData.categoryId}
                          onChange={(e) => applyCategory(e.target.value)}
                          disabled={sending || categoriesLoading}
                        >
                          <option value="">No category</option>
                          {categories.map((category) => (
                            <option key={category.categoryId} value={category.categoryId}>
                              {category.displayName}
                            </option>
                          ))}
                        </select>
                        {selectedCategory && (
                          <p className="text-xs text-slate-500 mt-1">
                            Loaded locked policy from {selectedCategory.categoryId}.
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="label">Channel</label>
                        <select
                          className="select"
                          value={formData.channel}
                          onChange={(e) => setFormData({ ...formData, channel: e.target.value as Channel })}
                          disabled={sending || Boolean(selectedCategory)}
                        >
                          {selectableChannels.map((channel) => (
                            <option key={channel} value={channel}>
                              {channel === 'EMAIL' ? 'Email' : channel === 'SMS' ? 'SMS' : 'Push'}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {selectedTemplate && (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 flex items-start gap-3">
                        <div className="stat-icon-wrap bg-primary-100 flex-shrink-0">
                          <FileText size={18} className="text-primary-700" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">{selectedTemplate.name}</div>
                          <div className="text-xs text-slate-500 mt-1">
                            {selectedTemplate.description || `Template ID: ${selectedTemplate.templateId}`}
                          </div>
                        </div>
                      </div>
                    )}

                    <div>
                      <label className="label">Message Template</label>
                      <select
                        className="select"
                        value={formData.templateId}
                        onChange={(e) => applyTemplate(e.target.value)}
                        disabled={sending || templatesLoading}
                      >
                        <option value="">No template</option>
                        {templates.map((template) => (
                          <option key={template.templateId} value={template.templateId}>
                            {template.name} ({template.channel})
                          </option>
                        ))}
                      </select>
                      {selectedTemplate && (
                        <p className="text-xs text-slate-500 mt-1">
                          Loaded {selectedTemplate.templateId}; subject and message can still be edited.
                        </p>
                      )}
                    </div>

                    {selectedTemplateVariables.length > 0 && (
                      <div className="rounded-lg border border-primary-100 bg-primary-50 p-3">
                        <div className="text-sm font-semibold text-slate-900 mb-2">Template Variables</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {selectedTemplateVariables.map((variable) => (
                            <div key={variable}>
                              <label className="label font-mono">{`{{${variable}}}`}</label>
                              <input
                                className="input bg-white"
                                value={templateVariables[variable] || ''}
                                onChange={(event) => setTemplateVariables({ ...templateVariables, [variable]: event.target.value })}
                                placeholder={variable === 'name' ? formData.userId : variable}
                                disabled={sending}
                              />
                            </div>
                          ))}
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                          These values are sent as `metadata.templateVariables` and rendered before delivery.
                        </p>
                      </div>
                    )}

                    <div>
                      <label className="label">Subject</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Complete your order"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        disabled={sending}
                      />
                    </div>

                    <div>
                      <label className="label">
                        Message <span className="text-danger-600">*</span>
                      </label>
                      <textarea
                        className="input"
                        rows={4}
                        placeholder="You left something in your cart."
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        disabled={sending}
                        required
                      />
                      <p className="text-xs text-slate-500 mt-1">
                        {formData.message.length} characters
                        {formData.channel === 'SMS' && formData.message.length > 160 && (
                          <span className="text-warning-600 ml-2">SMS messages over 160 characters may be split.</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {selectedCategory && shouldSendNotification && (
                <div className="rounded-lg border border-primary-100 bg-primary-50/50 p-4 flex items-start gap-3">
                  <div className="stat-icon-wrap bg-primary-100 flex-shrink-0 mt-0.5">
                    <Layers3 size={18} className="text-primary-700" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900">Loaded category: {selectedCategory.displayName}</div>
                    <div className="text-sm text-slate-600 mt-1">{selectedCategory.description || 'Organization category defaults loaded.'}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <span className="badge badge-info">{selectedCategory.defaultDeliveryMode}</span>
                      <span className="badge badge-neutral">{selectedCategory.messageCategory}</span>
                      <span className="badge badge-neutral">{selectedCategory.priorityClass}</span>
                      {selectedCategory.defaultDeliveryMode === 'OPTIMIZED' && (
                        <span className="badge badge-neutral">{selectedCategory.maxDelayHours}h max</span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {isOptimized && (
                <div className="rounded-lg border border-primary-100 bg-primary-50/40 p-4">
                  <div className="flex items-center gap-2 mb-4">
                    <ShieldCheck size={18} className="text-primary-700" />
                    <h4 className="font-semibold text-slate-900">Attention Escrow Inputs</h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="label">Source ID</label>
                      <input
                        className="input"
                        value={formData.sourceId}
                        onChange={(e) => setFormData({ ...formData, sourceId: e.target.value })}
                        disabled={sending}
                        placeholder="campaign:abandoned_cart"
                      />
                    </div>
                    <div>
                      <label className="label">Campaign ID</label>
                      <input
                        className="input"
                        value={formData.campaignId}
                        onChange={(e) => setFormData({ ...formData, campaignId: e.target.value })}
                        disabled={sending}
                        placeholder="abandoned_cart"
                      />
                    </div>
                    {(!selectedCategory || selectedCategory.defaultDeliveryMode === 'OPTIMIZED') && (
                      <div>
                        <label className="label">Max Delay Hours</label>
                        <input
                          type="number"
                          min={0}
                          max={48}
                          className="input"
                          value={formData.maxDelayHours}
                          onChange={(e) => setFormData({ ...formData, maxDelayHours: Number(e.target.value) })}
                          disabled={sending || Boolean(selectedCategory)}
                        />
                      </div>
                    )}
                    <div>
                      <label className="label">Message Category</label>
                      <select
                        className="select"
                        value={formData.messageCategory}
                        onChange={(e) => setFormData({ ...formData, messageCategory: e.target.value as MessageCategory })}
                        disabled={sending || Boolean(selectedCategory)}
                      >
                        {categoryOptions.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                      {selectedCategory && (
                        <div className="text-xs text-slate-500 mt-1">
                          Message category comes from the configured category identity.
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="label">Priority Class</label>
                      <select
                        className="select"
                        value={formData.priorityClass}
                        onChange={(e) => setFormData({ ...formData, priorityClass: e.target.value as PriorityClass })}
                        disabled={sending || Boolean(selectedCategory)}
                      >
                        {priorityOptions.map((value) => (
                          <option key={value} value={value}>{value}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Business Value: {formData.businessValue.toFixed(1)}</label>
                      <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.5"
                        value={formData.businessValue}
                        onChange={(e) => setFormData({ ...formData, businessValue: Number(e.target.value) })}
                        className="w-full accent-primary-600"
                        disabled={sending || Boolean(selectedCategory)}
                      />
                    </div>
                    <div>
                      <label className="label">Urgency: {formData.urgency.toFixed(1)}</label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={formData.urgency}
                        onChange={(e) => setFormData({ ...formData, urgency: Number(e.target.value) })}
                        className="w-full accent-primary-600"
                        disabled={sending || Boolean(selectedCategory)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-danger-50 border border-danger-200 text-danger-700 text-sm p-3 rounded-lg flex items-start gap-2">
                  <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={resetForm} className="btn-secondary" disabled={sending}>
                  Clear
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={sending}>
                  {sending ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Sending Event...
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      Send Event
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          <div className="space-y-6">
            <div className="card-flush overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">Request Payload</h3>
                <button className="btn-ghost text-xs" onClick={copyPayload}>
                  <Copy size={14} /> Copy
                </button>
              </div>
              <pre className="p-4 text-xs overflow-x-auto bg-slate-950 text-slate-100 max-h-[560px]">
                {JSON.stringify(eventPayload, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {eventLogs.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Recent Events</h3>
              <button
                onClick={() => setEventLogs([])}
                className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
              >
                <X size={14} />
                Clear
              </button>
            </div>

            <div className="space-y-2">
              {eventLogs.map((log) => {
                const ChannelIcon = channelIcon(log.channel)
                return (
                  <div
                    key={log.id}
                    className={`p-3 rounded-lg border ${
                      log.status === 'success'
                        ? 'bg-success-50 border-success-200'
                        : 'bg-danger-50 border-danger-200'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-md flex items-center justify-center ${
                            log.status === 'success' ? 'bg-success-100' : 'bg-danger-100'
                          }`}
                        >
                          {log.status === 'success' ? (
                            <CheckCircle size={16} className="text-success-700" />
                          ) : (
                            <AlertCircle size={16} className="text-danger-700" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-slate-900">{log.userId}</span>
                            <span className="badge badge-neutral text-xs">{log.type}</span>
                            <span className="badge badge-info text-xs">{log.deliveryMode}</span>
                            {log.channel && (
                              <span className="flex items-center gap-1 text-xs text-slate-600">
                                <ChannelIcon size={12} />
                                {log.channel}
                              </span>
                            )}
                          </div>
                          {log.message && <p className="text-sm text-slate-600 mt-1 truncate">{log.message}</p>}
                          {log.error && <p className="text-sm text-danger-700 mt-1">{log.error}</p>}
                        </div>
                      </div>

                      <span className="text-xs text-slate-500 flex-shrink-0">{formatTime(log.timestamp)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="card bg-slate-50">
          <h4 className="font-semibold text-slate-900 mb-2">How this page maps to the API</h4>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>`ANALYTICS_ONLY` sends no `notification` object.</li>
            <li>`IMMEDIATE` sends `notification.deliveryMode = IMMEDIATE` and invokes Sender Service.</li>
            <li>`OPTIMIZED` sends `notification.deliveryMode = OPTIMIZED`, then Decision Service writes an AttentionLedger decision.</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default Events
