import { useState, useEffect } from 'react'
import Layout from '@/components/common/Layout'
import {
  Plus,
  Search,
  Users as UsersIcon,
  UserPlus,
  Mail,
  Smartphone,
  Edit,
  Trash2,
  X,
  Loader2,
} from 'lucide-react'
import { useAuth } from '@/lib/auth'

interface User {
  userId: string
  email?: string
  phone?: string
  createdAt?: string
  createdBy?: string
  lastSeenAt?: string
  counters?: {
    events: number
    clicks: number
    sends: number
  }
}

interface UserStats {
  totalUsers: number
  apiCreated: number
  autoCreated: number
  unknownSource: number
  autoCreatedPercentage: number
}

const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT || ''

const Users = () => {
  const { getIdToken } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    email: '',
    phone: '',
  })

  // Load users and stats
  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const token = await getIdToken()

      // Load stats
      const statsRes = await fetch(`${API_ENDPOINT}/v1/users/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      }

      // TODO: Implement list users endpoint
      // For now, users list will be empty until you implement GET /v1/users endpoint
      setUsers([])
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.userId.trim()) {
      setError('User ID is required')
      return
    }

    if (!formData.email.trim() && !formData.phone.trim()) {
      setError('At least one contact method (email or phone) is required')
      return
    }

    try {
      setCreating(true)
      const token = await getIdToken()

      const payload: any = {
        userId: formData.userId.trim(),
      }

      if (formData.email.trim()) {
        payload.email = formData.email.trim()
      }

      if (formData.phone.trim()) {
        payload.phone = formData.phone.trim()
      }

      const res = await fetch(`${API_ENDPOINT}/v1/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to create user')
      }

      // Success
      setShowCreateModal(false)
      setFormData({ userId: '', email: '', phone: '' })
      loadData() // Reload data
    } catch (err: any) {
      setError(err.message || 'Failed to create user')
    } finally {
      setCreating(false)
    }
  }

  const filteredUsers = users.filter((u) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      u.userId.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q)
    )
  })

  const formatDate = (iso?: string) => {
    if (!iso) return 'Never'
    const d = new Date(iso)
    const now = new Date()
    const diff = now.getTime() - d.getTime()
    const mins = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins} min ago`
    if (hours < 24) return `${hours} h ago`
    return `${days} d ago`
  }

  return (
    <Layout
      actions={
        <button className="btn-primary" onClick={() => setShowCreateModal(true)}>
          <UserPlus size={16} /> Create User
        </button>
      }
    >
      <div className="space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="stat-card">
            <div className="stat-icon-wrap bg-primary-100">
              <UsersIcon size={18} className="text-primary-700" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Total Users</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {loading ? '...' : stats?.totalUsers.toLocaleString() || '0'}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap bg-success-100">
              <UserPlus size={18} className="text-success-700" />
            </div>
            <div>
              <div className="text-xs text-slate-500">API Created</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {loading ? '...' : stats?.apiCreated.toLocaleString() || '0'}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap bg-accent-100">
              <UsersIcon size={18} className="text-accent-600" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Auto-Created</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {loading ? '...' : stats?.autoCreated.toLocaleString() || '0'}
              </div>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon-wrap bg-warning-100">
              <UsersIcon size={18} className="text-warning-700" />
            </div>
            <div>
              <div className="text-xs text-slate-500">Auto %</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {loading ? '...' : `${stats?.autoCreatedPercentage.toFixed(1) || '0'}%`}
              </div>
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="card-flush p-4">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search by user ID, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Users Table */}
        <div className="card-flush">
          {loading ? (
            <div className="p-12 text-center text-slate-500">
              <Loader2 className="animate-spin mx-auto mb-2" size={24} />
              Loading users...
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-slate-500">
              <UsersIcon className="mx-auto mb-2 text-slate-300" size={48} />
              <p className="font-medium">No users yet</p>
              <p className="text-sm mt-1">Create your first user to get started</p>
              <button className="btn-primary mt-4" onClick={() => setShowCreateModal(true)}>
                <UserPlus size={16} /> Create User
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>User ID</th>
                    <th>Contact Info</th>
                    <th>Created</th>
                    <th>Source</th>
                    <th>Last Seen</th>
                    <th>Events</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        <div className="font-mono text-sm text-slate-900">{u.userId}</div>
                      </td>
                      <td>
                        <div className="space-y-1">
                          {u.email && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Mail size={14} />
                              {u.email}
                            </div>
                          )}
                          {u.phone && (
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Smartphone size={14} />
                              {u.phone}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="text-sm text-slate-500">{formatDate(u.createdAt)}</td>
                      <td>
                        <span
                          className={
                            u.createdBy === 'API'
                              ? 'badge badge-success'
                              : u.createdBy === 'AUTO_EVENT'
                              ? 'badge badge-info'
                              : 'badge badge-neutral'
                          }
                        >
                          {u.createdBy || 'Unknown'}
                        </span>
                      </td>
                      <td className="text-sm text-slate-500">{formatDate(u.lastSeenAt)}</td>
                      <td className="text-sm text-slate-600">
                        {u.counters?.events || 0} / {u.counters?.sends || 0} / {u.counters?.clicks || 0}
                      </td>
                      <td>
                        <div className="flex items-center gap-1">
                          <button className="btn-icon-sm" title="Edit user">
                            <Edit size={14} />
                          </button>
                          <button className="btn-icon-sm text-danger-600 hover:text-danger-700" title="Delete user">
                            <Trash2 size={14} />
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
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-elevated max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-900">Create New User</h3>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setError('')
                  setFormData({ userId: '', email: '', phone: '' })
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  User ID <span className="text-danger-600">*</span>
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="user123"
                  value={formData.userId}
                  onChange={(e) => setFormData({ ...formData, userId: e.target.value })}
                  disabled={creating}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">Unique identifier for this user</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  className="input"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+14155551234"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={creating}
                />
                <p className="text-xs text-slate-500 mt-1">E.164 format (e.g., +14155551234)</p>
              </div>

              <p className="text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
                <strong>Note:</strong> At least one contact method (email or phone) is required.
              </p>

              {error && (
                <div className="bg-danger-50 border border-danger-200 text-danger-700 text-sm p-3 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setError('')
                    setFormData({ userId: '', email: '', phone: '' })
                  }}
                  className="btn-secondary flex-1"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-primary flex-1" disabled={creating}>
                  {creating ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Creating...
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </Layout>
  )
}

export default Users
