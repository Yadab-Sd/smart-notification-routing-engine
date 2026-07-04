import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '@/components/common/Layout'
import { createAudience, deleteAudience, listAudiences, updateAudience } from '@/api/audiences'
import type { Audience } from '@/types'
import {
  AlertCircle,
  CheckCircle2,
  ClipboardList,
  Copy,
  Edit3,
  FileInput,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Users,
} from 'lucide-react'

const uniqueUserIds = (raw: string) =>
  Array.from(
    new Set(
      raw
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean)
    )
  )

const slugFromName = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '')

const timeLabel = (value?: string) => {
  if (!value) return 'Never'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

const normalizeError = (err: unknown) => {
  const maybe = err as { response?: { data?: { error?: string; message?: string }; status?: number }; message?: string }
  const apiMessage = maybe.response?.data?.error || maybe.response?.data?.message
  if (apiMessage && maybe.response?.status) return `${maybe.response.status}: ${apiMessage}`
  return apiMessage || maybe.message || 'Request failed'
}

const emptyDraft = {
  audienceId: '',
  name: '',
  description: '',
  userIdsText: '',
}

const demoUserIds = ['pilot_user_1', 'pilot_user_2', 'pilot_user_3', 'pilot_user_4', 'pilot_user_5', 'pilot_user_6']

const Audience = () => {
  const navigate = useNavigate()
  const [audiences, setAudiences] = useState<Audience[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedAudienceId, setSelectedAudienceId] = useState('')
  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const parsedUserIds = useMemo(() => uniqueUserIds(draft.userIdsText), [draft.userIdsText])
  const rawUserIdCount = useMemo(
    () => draft.userIdsText.split(/[\n,]+/).map((value) => value.trim()).filter(Boolean).length,
    [draft.userIdsText]
  )
  const duplicateCount = Math.max(0, rawUserIdCount - parsedUserIds.length)
  const selectedAudience = audiences.find((audience) => audience.audienceId === selectedAudienceId)
  const isExistingAudience = Boolean(selectedAudience)
  const campaignAudiencePath = isExistingAudience
    ? `/campaigns?audienceId=${encodeURIComponent(selectedAudienceId)}`
    : '/campaigns'

  const filteredAudiences = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return audiences
    return audiences.filter((audience) => {
      const haystack = [
        audience.audienceId,
        audience.name,
        audience.description || '',
        ...(audience.userIds || []),
      ].join(' ').toLowerCase()
      return haystack.includes(q)
    })
  }, [audiences, search])

  const totalRecipients = audiences.reduce((sum, audience) => sum + (audience.userIds?.length || 0), 0)
  const largestAudience = audiences.reduce<Audience | undefined>((current, audience) => {
    if (!current) return audience
    return (audience.userIds?.length || 0) > (current.userIds?.length || 0) ? audience : current
  }, undefined)

  const loadAudiences = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listAudiences()
      setAudiences((data.audiences || []).filter((audience) => audience.active !== false))
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAudiences()
  }, [])

  const resetDraft = () => {
    setSelectedAudienceId('')
    setDraft(emptyDraft)
    setError('')
    setNotice('')
  }

  const loadAudience = (audience: Audience) => {
    setSelectedAudienceId(audience.audienceId)
    setDraft({
      audienceId: audience.audienceId,
      name: audience.name,
      description: audience.description || '',
      userIdsText: (audience.userIds || []).join('\n'),
    })
    setError('')
    setNotice('')
  }

  const loadDemoAudience = () => {
    setSelectedAudienceId('')
    setDraft({
      audienceId: 'demo-public-health-pilot',
      name: 'Demo Public Health Pilot',
      description: 'Small reusable pilot list for appointment reminders, outreach checks, or campaign walkthroughs.',
      userIdsText: demoUserIds.join('\n'),
    })
    setError('')
    setNotice('Demo audience loaded. Save it, then use it from the Campaigns page.')
  }

  const audiencePayload = (): Audience => ({
    audienceId: draft.audienceId.trim() || slugFromName(draft.name) || 'audience',
    name: draft.name.trim(),
    description: draft.description.trim(),
    userIds: parsedUserIds,
    active: true,
  })

  const saveAudience = async () => {
    setError('')
    setNotice('')
    const payload = audiencePayload()

    if (!payload.audienceId) {
      setError('Audience ID is required.')
      return
    }
    if (!payload.name) {
      setError('Audience name is required.')
      return
    }
    if (!payload.userIds.length) {
      setError('Add at least one user ID before saving.')
      return
    }
    if (payload.userIds.length > 100) {
      setError('Campaign batch preview currently supports up to 100 users. Split larger lists into smaller audiences for this MVP.')
      return
    }

    setSaving(true)
    try {
      const exists = audiences.some((audience) => audience.audienceId === payload.audienceId)
      const saved = exists
        ? await updateAudience(payload.audienceId, payload)
        : await createAudience(payload)
      setSelectedAudienceId(saved.audienceId)
      setDraft({
        audienceId: saved.audienceId,
        name: saved.name,
        description: saved.description || '',
        userIdsText: (saved.userIds || []).join('\n'),
      })
      await loadAudiences()
      setNotice(exists ? 'Audience updated.' : 'Audience saved. You can now load it from Campaigns.')
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setSaving(false)
    }
  }

  const removeAudience = async (audience: Audience) => {
    if (!window.confirm(`Delete audience "${audience.name}"? Existing campaign launch history will remain.`)) return
    setError('')
    setNotice('')
    setDeletingId(audience.audienceId)
    try {
      await deleteAudience(audience.audienceId)
      await loadAudiences()
      if (selectedAudienceId === audience.audienceId) resetDraft()
      setNotice('Audience deleted. Existing campaign launch history remains available.')
    } catch (err) {
      setError(normalizeError(err))
    } finally {
      setDeletingId(null)
    }
  }

  const copyUserIds = async (audience: Audience) => {
    await navigator.clipboard.writeText((audience.userIds || []).join('\n'))
    setNotice(`Copied ${audience.userIds?.length || 0} user IDs from ${audience.name}.`)
  }

  const updateDraft = (field: keyof typeof emptyDraft, value: string) => {
    setDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === 'name' && !isExistingAudience && !current.audienceId
        ? { audienceId: slugFromName(value) }
        : {}),
    }))
  }

  const stats = [
    { label: 'Saved audiences', value: audiences.length, icon: ClipboardList },
    { label: 'Reusable recipients', value: totalRecipients, icon: Users },
    { label: 'Draft users', value: parsedUserIds.length, icon: FileInput },
    { label: 'Largest list', value: largestAudience ? largestAudience.userIds?.length || 0 : 0, icon: Megaphone },
  ]

  return (
    <Layout
      title="Audience"
      subtitle="Reusable recipient lists for campaign previews and launches"
      actions={
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={loadDemoAudience}>
            <FileInput size={16} />
            Load demo
          </button>
          <button className="btn-primary" onClick={resetDraft}>
            <Plus size={16} />
            New audience
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
                <div className="text-2xl font-bold text-slate-900 mt-1">{item.value.toLocaleString('en-US')}</div>
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

        {notice && (
          <div className="rounded-lg border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700 flex items-start gap-2">
            <CheckCircle2 size={16} className="mt-0.5 flex-shrink-0" />
            <span>{notice}</span>
          </div>
        )}

        <div className="grid xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)] gap-6">
          <section className="card-flush">
            <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Audience library</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Save named user ID lists once, then load them into campaign previews without re-pasting.
                </p>
              </div>
              <button className="btn-secondary" onClick={loadAudiences} disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                Refresh
              </button>
            </div>

            <div className="p-5 border-b border-slate-100">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  className="input pl-9"
                  placeholder="Search audience name, ID, notes, or user ID..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Audience</th>
                    <th>Recipients</th>
                    <th>Updated</th>
                    <th className="text-right pr-6">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAudiences.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="text-center text-slate-500 py-10">
                        {loading ? 'Loading audiences...' : 'No audiences found. Create one from the panel on the right.'}
                      </td>
                    </tr>
                  ) : (
                    filteredAudiences.map((audience) => (
                      <tr key={audience.audienceId} className={selectedAudienceId === audience.audienceId ? 'bg-primary-50/60' : ''}>
                        <td>
                          <div className="font-medium text-slate-900">{audience.name}</div>
                          <div className="text-xs text-slate-400 font-mono">{audience.audienceId}</div>
                          {audience.description && (
                            <div className="text-xs text-slate-500 mt-1 max-w-lg">{audience.description}</div>
                          )}
                        </td>
                        <td>
                          <div className="font-semibold text-slate-900">{(audience.userIds?.length || 0).toLocaleString('en-US')}</div>
                          <div className="text-xs text-slate-500">saved user IDs</div>
                        </td>
                        <td className="text-slate-600">{timeLabel(audience.updatedAt || audience.createdAt)}</td>
                        <td className="text-right pr-6">
                          <div className="flex justify-end gap-2">
                            <button className="btn-secondary text-xs" onClick={() => loadAudience(audience)}>
                              <Edit3 size={14} />
                              Edit
                            </button>
                            <button className="btn-secondary text-xs" onClick={() => copyUserIds(audience)}>
                              <Copy size={14} />
                              Copy IDs
                            </button>
                            <button
                              className="btn-secondary text-xs text-danger-700"
                              onClick={() => removeAudience(audience)}
                              disabled={deletingId === audience.audienceId}
                            >
                              {deletingId === audience.audienceId ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
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
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-slate-900">
                {isExistingAudience ? 'Edit audience' : 'Create audience'}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                MVP audiences are explicit recipient lists. Dynamic rule-based segments can come later after profile attributes mature.
              </p>
            </div>

            <div className="p-5 space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="label">Audience name</label>
                  <input
                    className="input"
                    value={draft.name}
                    onChange={(event) => updateDraft('name', event.target.value)}
                    placeholder="Pilot Users"
                  />
                </div>
                <div>
                  <label className="label">Audience ID</label>
                  <input
                    className="input font-mono"
                    value={draft.audienceId}
                    onChange={(event) => updateDraft('audienceId', event.target.value)}
                    placeholder="pilot-users"
                  />
                </div>
              </div>

              <div>
                <label className="label">Internal notes</label>
                <textarea
                  className="input min-h-20"
                  value={draft.description}
                  onChange={(event) => updateDraft('description', event.target.value)}
                  placeholder="Who owns this list, when to use it, or what source system it came from."
                />
              </div>

              <div>
                <label className="label">User IDs</label>
                <textarea
                  className="input min-h-56 font-mono text-sm"
                  value={draft.userIdsText}
                  onChange={(event) => updateDraft('userIdsText', event.target.value)}
                  placeholder="One userId per line, or comma separated"
                />
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="text-slate-500">Parsed</div>
                    <div className="font-semibold text-slate-900">{parsedUserIds.length}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="text-slate-500">Duplicates</div>
                    <div className="font-semibold text-slate-900">{duplicateCount}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="text-slate-500">MVP limit</div>
                    <div className={parsedUserIds.length > 100 ? 'font-semibold text-danger-700' : 'font-semibold text-slate-900'}>
                      100
                    </div>
                  </div>
                </div>
              </div>

              {parsedUserIds.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="text-sm font-medium text-slate-900">Recipient preview</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {parsedUserIds.slice(0, 12).map((userId) => (
                      <span key={userId} className="badge badge-neutral font-mono">
                        {userId}
                      </span>
                    ))}
                    {parsedUserIds.length > 12 && (
                      <span className="badge badge-info">+{parsedUserIds.length - 12} more</span>
                    )}
                  </div>
                </div>
              )}

              <div className="rounded-lg border border-primary-100 bg-primary-50 p-4 text-sm text-primary-800">
                <div className="font-medium">How this is used</div>
                <p className="mt-1">
                  Campaigns load audiences into the batch preview form. Admins can still edit the recipients before preview, and launch history stores the audience ID when the saved list is used unchanged.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button className="btn-primary" onClick={saveAudience} disabled={saving}>
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  {isExistingAudience ? 'Update audience' : 'Save audience'}
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => navigate(campaignAudiencePath)}
                  disabled={!isExistingAudience}
                  title={isExistingAudience ? 'Load this audience in Campaigns' : 'Save the audience before using it in Campaigns'}
                >
                  <Megaphone size={16} />
                  Use in Campaigns
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Layout>
  )
}

export default Audience
