import { useEffect, useMemo, useState } from 'react'
import Layout from '@/components/common/Layout'
import { createTemplate, deleteTemplate, listTemplates, updateTemplate } from '@/api/templates'
import type { MessageCategory, NotificationChannel, NotificationTemplate } from '@/types'
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Edit3,
  Eye,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from 'lucide-react'

const channels: NotificationChannel[] = ['EMAIL', 'SMS', 'PUSH']
const messageCategories: MessageCategory[] = [
  'GENERAL',
  'MARKETING',
  'PROMOTION',
  'NEWSLETTER',
  'TRANSACTIONAL',
  'SECURITY',
  'EMERGENCY',
]

const emptyTemplate: NotificationTemplate = {
  templateId: '',
  name: '',
  description: '',
  channel: 'EMAIL',
  messageCategory: 'GENERAL',
  subject: '',
  body: '',
  variables: [],
  active: true,
}

const slugFromName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '')

const extractVariables = (subject = '', body = '') =>
  Array.from(
    new Set(
      `${subject}\n${body}`
        .match(/\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}/g)
        ?.map((match) => match.replace(/[{}]/g, '').trim())
        .filter(Boolean) || []
    )
  )

const normalizeError = (err: unknown) => {
  const maybe = err as { response?: { data?: { error?: string; message?: string }; status?: number }; message?: string }
  const apiMessage = maybe.response?.data?.error || maybe.response?.data?.message
  if (apiMessage && maybe.response?.status) return `${maybe.response.status}: ${apiMessage}`
  return apiMessage || maybe.message || 'Request failed'
}

const timeLabel = (value?: string) => {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

const channelIcon = (channel: NotificationChannel) => {
  if (channel === 'SMS') return MessageSquare
  return Mail
}

const Templates = () => {
  const [templates, setTemplates] = useState<NotificationTemplate[]>([])
  const [organizationId, setOrganizationId] = useState('default')
  const [form, setForm] = useState<NotificationTemplate>(emptyTemplate)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selected, setSelected] = useState<NotificationTemplate | null>(null)
  const [search, setSearch] = useState('')
  const [channelFilter, setChannelFilter] = useState<NotificationChannel | 'ALL'>('ALL')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const detectedVariables = useMemo(
    () => extractVariables(form.subject, form.body),
    [form.subject, form.body]
  )

  const profileVariables = [
    { key: 'userId', hint: 'Always available from the user record' },
    { key: 'name', hint: 'Display name; falls back to first name or user ID' },
    { key: 'firstName', hint: 'Optional user profile field' },
    { key: 'lastName', hint: 'Optional user profile field' },
    { key: 'email', hint: 'User email address' },
    { key: 'phone', hint: 'User phone number' },
  ]

  const activeCount = useMemo(() => templates.filter((template) => template.active !== false).length, [templates])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return templates.filter((template) => {
      if (channelFilter !== 'ALL' && template.channel !== channelFilter) return false
      if (!q) return true
      return [
        template.templateId,
        template.name,
        template.description || '',
        template.subject || '',
        template.body,
        ...(template.variables || []),
      ].join(' ').toLowerCase().includes(q)
    })
  }, [templates, search, channelFilter])

  const loadTemplates = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listTemplates()
      setTemplates(data.templates || [])
      setOrganizationId(data.organizationId || 'default')
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTemplates()
  }, [])

  const resetForm = () => {
    setForm(emptyTemplate)
    setEditingId(null)
    setSelected(null)
    setError('')
    setNotice('')
  }

  const selectTemplate = (template: NotificationTemplate) => {
    setEditingId(template.templateId)
    setSelected(null)
    setForm({
      ...emptyTemplate,
      ...template,
      variables: template.variables || extractVariables(template.subject, template.body),
      active: template.active !== false,
    })
    setError('')
    setNotice('')
    document.getElementById('template-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const duplicateTemplate = (template: NotificationTemplate) => {
    const copyId = `${template.templateId}-copy`
    setEditingId(null)
    setForm({
      ...emptyTemplate,
      ...template,
      templateId: copyId,
      name: `${template.name} Copy`,
      variables: template.variables || extractVariables(template.subject, template.body),
      active: true,
      createdAt: undefined,
      updatedAt: undefined,
    })
    setNotice('Template copied into the form. Review the ID and save it as a new template.')
    document.getElementById('template-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const updateForm = <K extends keyof NotificationTemplate>(field: K, value: NotificationTemplate[K]) => {
    setForm((current) => ({
      ...current,
      [field]: value,
      ...(field === 'name' && !editingId && !current.templateId
        ? { templateId: slugFromName(String(value)) }
        : {}),
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const variables = detectedVariables.length ? detectedVariables : form.variables || []
    const payload: NotificationTemplate = {
      ...form,
      templateId: form.templateId.trim(),
      name: form.name.trim(),
      description: form.description?.trim(),
      subject: form.subject?.trim(),
      body: form.body.trim(),
      variables,
      active: form.active !== false,
    }

    try {
      const successNotice = editingId ? 'Template updated.' : 'Template created.'
      if (editingId) {
        await updateTemplate(editingId, payload)
      } else {
        await createTemplate(payload)
      }
      await loadTemplates()
      setForm(emptyTemplate)
      setEditingId(null)
      setSelected(null)
      setNotice(successNotice)
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (template: NotificationTemplate) => {
    if (!window.confirm(`Delete template "${template.name}"? Existing campaigns/events that reference its ID will keep their history.`)) {
      return
    }
    setDeletingId(template.templateId)
    setError('')
    setNotice('')
    try {
      await deleteTemplate(template.templateId)
      await loadTemplates()
      if (editingId === template.templateId) resetForm()
      setNotice('Template deleted. Existing send history remains available.')
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setDeletingId(null)
    }
  }

  const stats = [
    { label: 'Organization', value: organizationId },
    { label: 'Saved templates', value: templates.length },
    { label: 'Active templates', value: activeCount },
  ]

  return (
    <Layout
      actions={
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={loadTemplates} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
          <button className="btn-primary" onClick={resetForm}>
            <Plus size={16} /> New template
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div className="card" key={stat.label}>
              <div className="text-xs text-slate-500">{stat.label}</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{stat.value}</div>
            </div>
          ))}
        </div>

        {notice && (
          <div className="bg-success-50 border border-success-200 text-success-700 p-4 rounded-lg flex items-center gap-3">
            <CheckCircle2 size={18} />
            <span className="font-medium">{notice}</span>
          </div>
        )}

        {error && (
          <div className="bg-danger-50 border border-danger-200 text-danger-700 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_430px] gap-6">
          <div className="card">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-5">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Template Library</h3>
                <p className="text-sm text-slate-500 mt-1">Reusable structured content for campaigns and one-off sends.</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input pl-9 sm:w-64"
                    placeholder="Search templates..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </div>
                <select
                  className="select sm:w-40"
                  value={channelFilter}
                  onChange={(event) => setChannelFilter(event.target.value as NotificationChannel | 'ALL')}
                >
                  <option value="ALL">All channels</option>
                  {channels.map((channel) => (
                    <option key={channel} value={channel}>{channel}</option>
                  ))}
                </select>
              </div>
            </div>

            {loading ? (
              <div className="py-16 flex items-center justify-center text-slate-500">
                <Loader2 size={20} className="animate-spin mr-2" /> Loading templates...
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <FileText className="mx-auto mb-3 text-slate-300" size={44} />
                <div className="font-medium text-slate-700">No templates found</div>
                <div className="text-sm mt-1">Create a template to reuse subject/body structure across campaigns.</div>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((template) => {
                  const Icon = channelIcon(template.channel)
                  return (
                    <div key={template.templateId} className="border border-slate-200 rounded-lg p-4 hover:border-primary-200 transition-colors">
                      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="stat-icon-wrap bg-primary-100 w-8 h-8">
                              <Icon size={16} className="text-primary-700" />
                            </span>
                            <div className="font-semibold text-slate-900">{template.name}</div>
                            <span className="badge badge-info">{template.channel}</span>
                            <span className="badge badge-warning">{template.messageCategory}</span>
                            {template.active === false && <span className="badge badge-danger">Inactive</span>}
                          </div>
                          <div className="text-xs text-slate-400 font-mono mt-2">{template.templateId}</div>
                          {template.description && <p className="text-sm text-slate-600 mt-2">{template.description}</p>}
                          {template.subject && <div className="text-sm font-medium text-slate-800 mt-3">{template.subject}</div>}
                          <p className="text-sm text-slate-600 mt-2 line-clamp-2">{template.body}</p>
                          <div className="flex flex-wrap gap-2 mt-3">
                            {(template.variables || []).slice(0, 6).map((variable) => (
                              <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600 font-mono" key={variable}>
                                {`{{${variable}}}`}
                              </span>
                            ))}
                            {(template.variables || []).length > 6 && (
                              <span className="text-xs px-2 py-1 rounded bg-slate-100 text-slate-600">
                                +{(template.variables || []).length - 6} more
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-3">Updated {timeLabel(template.updatedAt)}</div>
                        </div>
                        <div className="flex lg:flex-col gap-2">
                          <button className="btn-secondary text-sm" onClick={() => setSelected(template)}>
                            <Eye size={14} /> Preview
                          </button>
                          <button className="btn-secondary text-sm" onClick={() => selectTemplate(template)}>
                            <Edit3 size={14} /> Edit
                          </button>
                          <button className="btn-secondary text-sm" onClick={() => duplicateTemplate(template)}>
                            <Copy size={14} /> Copy
                          </button>
                          <button
                            className="btn-danger text-sm"
                            onClick={() => handleDelete(template)}
                            disabled={deletingId === template.templateId}
                          >
                            {deletingId === template.templateId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <form id="template-form" className="card space-y-4" onSubmit={handleSubmit}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">{editingId ? 'Edit Template' : 'New Template'}</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Use Handlebars-style variables such as {`{{name}}`} or {`{{appointmentTime}}`}.
                </p>
              </div>
              {editingId && (
                <button type="button" className="btn-ghost text-sm" onClick={resetForm}>
                  Clear
                </button>
              )}
            </div>

            <div className="rounded-lg border border-primary-100 bg-primary-50 p-3">
              <div className="text-xs font-semibold text-primary-800 uppercase tracking-wide">Available Variables</div>
              <div className="grid sm:grid-cols-2 gap-2 mt-2">
                {profileVariables.map((variable) => (
                  <div key={variable.key} className="rounded-md bg-white/80 border border-primary-100 px-2 py-1.5">
                    <div className="font-mono text-xs text-primary-800">{`{{${variable.key}}}`}</div>
                    <div className="text-[11px] text-slate-600 mt-0.5">{variable.hint}</div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-600 mt-2">
                Custom placeholders are detected automatically and shown as fill-in fields when the template is used.
              </p>
            </div>

            <div>
              <label className="label">Template ID</label>
              <input
                className="input"
                value={form.templateId}
                onChange={(event) => updateForm('templateId', event.target.value)}
                disabled={Boolean(editingId)}
                placeholder="appointment-reminder-v1"
              />
            </div>

            <div>
              <label className="label">Name</label>
              <input
                className="input"
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                placeholder="Appointment Reminder"
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                className="input min-h-[72px]"
                value={form.description || ''}
                onChange={(event) => updateForm('description', event.target.value)}
                placeholder="When this template should be used"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Channel</label>
                <select
                  className="select"
                  value={form.channel}
                  onChange={(event) => updateForm('channel', event.target.value as NotificationChannel)}
                >
                  {channels.map((channel) => (
                    <option key={channel} value={channel}>{channel}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Message Category</label>
                <select
                  className="select"
                  value={form.messageCategory}
                  onChange={(event) => updateForm('messageCategory', event.target.value as MessageCategory)}
                >
                  {messageCategories.map((category) => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Subject</label>
              <input
                className="input"
                value={form.subject || ''}
                onChange={(event) => updateForm('subject', event.target.value)}
                placeholder="Your appointment is coming up"
              />
            </div>

            <div>
              <label className="label">Body</label>
              <textarea
                className="input min-h-[160px]"
                value={form.body}
                onChange={(event) => updateForm('body', event.target.value)}
                placeholder="Hi {{name}}, this is a reminder for {{appointmentTime}}."
              />
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Detected Variables</div>
              <div className="flex flex-wrap gap-2 mt-2">
                {detectedVariables.length === 0 ? (
                  <span className="text-sm text-slate-500">No variables detected.</span>
                ) : (
                  detectedVariables.map((variable) => (
                    <span className="text-xs px-2 py-1 rounded bg-white border border-slate-200 text-slate-700 font-mono" key={variable}>
                      {`{{${variable}}}`}
                    </span>
                  ))
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.active !== false}
                onChange={(event) => updateForm('active', event.target.checked)}
              />
              Active
            </label>

            <button className="btn-primary w-full" disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {editingId ? 'Save Changes' : 'Create Template'}
            </button>
          </form>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 animate-fade-in"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white rounded-xl shadow-elevated border border-slate-100 max-w-2xl w-full overflow-hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-900">Template Preview</div>
                <div className="text-xs text-slate-500 mt-1">{selected.templateId} · {selected.channel}</div>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-500 hover:text-slate-900">x</button>
            </div>
            <div className="p-5 space-y-4">
              {selected.subject && (
                <div>
                  <div className="label">Subject</div>
                  <div className="rounded-lg border border-slate-200 p-3 text-sm font-medium text-slate-900">
                    {selected.subject}
                  </div>
                </div>
              )}
              <div>
                <div className="label">Body</div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {selected.body}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
              <button onClick={() => setSelected(null)} className="btn-secondary text-sm">Close</button>
              <button onClick={() => selectTemplate(selected)} className="btn-primary text-sm">
                <Edit3 size={14} /> Edit
              </button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default Templates
