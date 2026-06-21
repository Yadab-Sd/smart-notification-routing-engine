import { useEffect, useMemo, useState } from 'react'
import Layout from '@/components/common/Layout'
import {
  AlertCircle,
  CheckCircle,
  Edit3,
  Layers3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'
import { createCategory, deleteCategory, listCategories, updateCategory } from '@/api/categories'
import type {
  DeliveryMode,
  MessageCategory,
  NotificationCategory,
  NotificationChannel,
  PriorityClass,
  RiskClass,
} from '@/types'

const deliveryModes: DeliveryMode[] = ['OPTIMIZED', 'IMMEDIATE']
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
const priorityClasses: PriorityClass[] = ['LOW', 'STANDARD', 'HIGH', 'TRANSACTIONAL', 'SECURITY', 'EMERGENCY']
const riskClasses: RiskClass[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'REGULATED']

const emptyCategory: NotificationCategory = {
  categoryId: '',
  displayName: '',
  description: '',
  defaultDeliveryMode: 'OPTIMIZED',
  allowedChannels: ['EMAIL'],
  messageCategory: 'GENERAL',
  riskClass: 'LOW',
  priorityClass: 'STANDARD',
  businessValue: 5,
  urgency: 0.4,
  maxDelayHours: 24,
  quietHoursRespect: true,
  active: true,
}

const normalizeError = (err: unknown) => {
  const maybe = err as { response?: { data?: { error?: string; message?: string }; status?: number }; message?: string }
  const apiMessage = maybe.response?.data?.error || maybe.response?.data?.message
  if (apiMessage && maybe.response?.status) return `${maybe.response.status}: ${apiMessage}`
  return apiMessage || maybe.message || 'Request failed'
}

const Categories = () => {
  const [categories, setCategories] = useState<NotificationCategory[]>([])
  const [organizationId, setOrganizationId] = useState('default')
  const [form, setForm] = useState<NotificationCategory>(emptyCategory)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const activeCount = useMemo(() => categories.filter((category) => category.active !== false).length, [categories])
  const optimizedCount = useMemo(
    () => categories.filter((category) => category.defaultDeliveryMode === 'OPTIMIZED').length,
    [categories]
  )

  const loadCategories = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listCategories()
      setCategories(data.categories || [])
      setOrganizationId(data.organizationId || 'default')
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const resetForm = () => {
    setForm(emptyCategory)
    setEditingId(null)
    setError('')
  }

  const selectCategory = (category: NotificationCategory) => {
    setEditingId(category.categoryId)
    setForm({
      ...emptyCategory,
      ...category,
      allowedChannels: category.allowedChannels?.filter((channel) => channel !== 'AUTO') || ['EMAIL'],
      active: category.active !== false,
      quietHoursRespect: category.quietHoursRespect !== false,
    })
    setError('')
    document.getElementById('category-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const toggleChannel = (channel: NotificationChannel) => {
    const current = form.allowedChannels || []
    const next = current.includes(channel)
      ? current.filter((value) => value !== channel)
      : [...current, channel]
    setForm({ ...form, allowedChannels: next.length > 0 ? next : [channel] })
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError('')
    setNotice('')

    const payload: NotificationCategory = {
      ...form,
      categoryId: form.categoryId.trim(),
      displayName: form.displayName.trim(),
      description: form.description?.trim(),
      allowedChannels: form.allowedChannels?.length ? form.allowedChannels : ['EMAIL'],
      businessValue: Number(form.businessValue),
      urgency: Number(form.urgency),
      maxDelayHours: Number(form.maxDelayHours),
      active: form.active !== false,
      quietHoursRespect: form.quietHoursRespect !== false,
    }

    try {
      if (editingId) {
        await updateCategory(editingId, payload)
        setNotice('Category updated.')
      } else {
        await createCategory(payload)
        setNotice('Category created.')
      }
      await loadCategories()
      resetForm()
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (categoryId: string) => {
    if (!window.confirm(`Delete category "${categoryId}"?`)) return
    setError('')
    setNotice('')
    try {
      await deleteCategory(categoryId)
      setNotice('Category deleted.')
      await loadCategories()
      if (editingId === categoryId) resetForm()
    } catch (err) {
      setError(normalizeError(err))
    }
  }

  return (
    <Layout
      actions={
        <button className="btn-secondary" onClick={loadCategories} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="flex items-start gap-3">
              <div className="stat-icon-wrap bg-primary-100">
                <Layers3 size={18} className="text-primary-700" />
              </div>
              <div>
                <div className="text-xs text-slate-500">Organization</div>
                <div className="text-2xl font-bold text-slate-900">{organizationId}</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-start gap-3">
              <div className="stat-icon-wrap bg-success-100">
                <CheckCircle size={18} className="text-success-700" />
              </div>
              <div>
                <div className="text-xs text-slate-500">Active Categories</div>
                <div className="text-2xl font-bold text-slate-900">{activeCount}</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="flex items-start gap-3">
              <div className="stat-icon-wrap bg-warning-100">
                <Layers3 size={18} className="text-warning-700" />
              </div>
              <div>
                <div className="text-xs text-slate-500">Optimized Defaults</div>
                <div className="text-2xl font-bold text-slate-900">{optimizedCount}</div>
              </div>
            </div>
          </div>
        </div>

        {notice && (
          <div className="bg-success-50 border border-success-200 text-success-700 p-4 rounded-lg flex items-center gap-3">
            <CheckCircle size={18} />
            <span className="font-medium">{notice}</span>
          </div>
        )}

        {error && (
          <div className="bg-danger-50 border border-danger-200 text-danger-700 p-4 rounded-lg flex items-start gap-3">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Category Policies</h3>
              <button className="btn-ghost text-sm" onClick={resetForm}>
                <Plus size={15} /> New
              </button>
            </div>

            {loading ? (
              <div className="py-16 flex items-center justify-center text-slate-500">
                <Loader2 size={20} className="animate-spin mr-2" /> Loading categories...
              </div>
            ) : categories.length === 0 ? (
              <div className="py-16 text-center text-slate-500">
                <Layers3 className="mx-auto mb-3 text-slate-300" size={44} />
                <div className="font-medium text-slate-700">No categories yet</div>
                <div className="text-sm mt-1">Create one to prefill event sends with reusable policy defaults.</div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Policy</th>
                      <th>Value</th>
                      <th>Window</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr key={category.categoryId}>
                        <td>
                          <div className="font-medium text-slate-900">{category.displayName}</div>
                          <div className="text-xs text-slate-500">{category.categoryId}</div>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            <span className="badge badge-info">{category.defaultDeliveryMode}</span>
                            <span className="badge badge-neutral">{category.messageCategory}</span>
                            <span className="badge badge-neutral">{category.priorityClass}</span>
                            {category.active === false && <span className="badge badge-danger">INACTIVE</span>}
                          </div>
                        </td>
                        <td>
                          <div className="text-sm text-slate-700">Value {category.businessValue.toFixed(1)}</div>
                          <div className="text-xs text-slate-500">Urgency {category.urgency.toFixed(1)}</div>
                        </td>
                        <td>
                          <div className="text-sm text-slate-700">{category.maxDelayHours}h max</div>
                          <div className="text-xs text-slate-500">
                            {(category.allowedChannels || []).join(', ') || 'No channels'}
                          </div>
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <button className="btn-ghost text-xs" onClick={() => selectCategory(category)}>
                              <Edit3 size={14} /> Edit
                            </button>
                            <button className="btn-ghost text-xs text-danger-600" onClick={() => handleDelete(category.categoryId)}>
                              <Trash2 size={14} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <form id="category-form" onSubmit={handleSubmit} className="card space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {editingId ? 'Edit Category' : 'Create Category'}
              </h3>
              <p className="text-sm text-slate-500 mt-1">Defaults fill event fields, but send-time values stay editable.</p>
            </div>

            <div>
              <label className="label">Category ID</label>
              <input
                className="input"
                value={form.categoryId}
                onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                disabled={saving || Boolean(editingId)}
                placeholder="appointment_reminder"
                required
              />
            </div>

            <div>
              <label className="label">Display Name</label>
              <input
                className="input"
                value={form.displayName}
                onChange={(event) => setForm({ ...form, displayName: event.target.value })}
                disabled={saving}
                placeholder="Appointment Reminder"
                required
              />
            </div>

            <div>
              <label className="label">Description</label>
              <textarea
                className="input"
                rows={3}
                value={form.description || ''}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                disabled={saving}
                placeholder="Reminder before a scheduled appointment"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label">Default Delivery</label>
                <select
                  className="select"
                  value={form.defaultDeliveryMode}
                  onChange={(event) => setForm({ ...form, defaultDeliveryMode: event.target.value as DeliveryMode })}
                  disabled={saving}
                >
                  {deliveryModes.map((mode) => <option key={mode}>{mode}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Risk Class</label>
                <select
                  className="select"
                  value={form.riskClass}
                  onChange={(event) => setForm({ ...form, riskClass: event.target.value as RiskClass })}
                  disabled={saving}
                >
                  {riskClasses.map((risk) => <option key={risk}>{risk}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Message Category</label>
                <select
                  className="select"
                  value={form.messageCategory}
                  onChange={(event) => setForm({ ...form, messageCategory: event.target.value as MessageCategory })}
                  disabled={saving}
                >
                  {messageCategories.map((category) => <option key={category}>{category}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Priority Class</label>
                <select
                  className="select"
                  value={form.priorityClass}
                  onChange={(event) => setForm({ ...form, priorityClass: event.target.value as PriorityClass })}
                  disabled={saving}
                >
                  {priorityClasses.map((priority) => <option key={priority}>{priority}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="label">Allowed Channels</label>
              <div className="flex flex-wrap gap-2">
                {channels.map((channel) => (
                  <button
                    key={channel}
                    type="button"
                    className={(form.allowedChannels || []).includes(channel) ? 'btn-primary py-2 px-3' : 'btn-secondary py-2 px-3'}
                    onClick={() => toggleChannel(channel)}
                    disabled={saving}
                  >
                    {channel}
                  </button>
                ))}
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
                onChange={(event) => setForm({ ...form, businessValue: Number(event.target.value) })}
                className="w-full accent-primary-600"
                disabled={saving}
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
                onChange={(event) => setForm({ ...form, urgency: Number(event.target.value) })}
                className="w-full accent-primary-600"
                disabled={saving}
              />
            </div>

            <div>
              <label className="label">Max Delay Hours</label>
              <input
                type="number"
                min={0}
                max={48}
                className="input"
                value={form.maxDelayHours}
                onChange={(event) => setForm({ ...form, maxDelayHours: Number(event.target.value) })}
                disabled={saving}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.quietHoursRespect !== false}
                  onChange={(event) => setForm({ ...form, quietHoursRespect: event.target.checked })}
                  disabled={saving}
                />
                Respect quiet hours
              </label>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active !== false}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  disabled={saving}
                />
                Active
              </label>
            </div>

            <div className="flex gap-3">
              <button type="button" className="btn-secondary" onClick={resetForm} disabled={saving}>
                Clear
              </button>
              <button type="submit" className="btn-primary flex-1" disabled={saving}>
                {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                {editingId ? 'Save Category' : 'Create Category'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Layout>
  )
}

export default Categories
