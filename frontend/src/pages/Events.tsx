import { useState } from 'react'
import Layout from '@/components/common/Layout'
import {
  Send,
  Zap,
  Calendar,
  Mail,
  MessageSquare,
  Bell,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { ENV } from '@/config/env'

const API_ENDPOINT = ENV.API_URL

interface EventLog {
  id: string
  userId: string
  type: string
  notificationType: string
  channel: string
  status: 'success' | 'error'
  timestamp: string
  message?: string
  error?: string
}

const Events = () => {
  const { getIdToken } = useAuth()
  const [sending, setSending] = useState(false)
  const [eventLogs, setEventLogs] = useState<EventLog[]>([])
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    userId: '',
    email: '',
    phone: '',
    type: 'NOTIFICATION',
    notificationType: 'immediate',
    channel: 'email',
    message: '',
    subject: '',
  })

  const handleSendEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSending(true)

    try {
      const token = await getIdToken()

      // Build event payload
      const payload: any = {
        userId: formData.userId.trim(),
        type: formData.type,
        notificationType: formData.notificationType,
        channel: formData.channel,
        message: formData.message.trim(),
        ts: new Date().toISOString(),
      }

      // Add contact info if provided
      if (formData.email.trim()) {
        payload.email = formData.email.trim()
      }
      if (formData.phone.trim()) {
        payload.phone = formData.phone.trim()
      }

      // Add subject for email
      if (formData.channel === 'email' && formData.subject.trim()) {
        payload.metadata = {
          subject: formData.subject.trim(),
        }
      }

      const res = await fetch(`${API_ENDPOINT}/v1/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to send event')
      }

      // Success - add to log
      const newLog: EventLog = {
        id: Date.now().toString(),
        userId: formData.userId,
        type: formData.type,
        notificationType: formData.notificationType,
        channel: formData.channel,
        status: 'success',
        timestamp: new Date().toISOString(),
        message: formData.message.substring(0, 50) + (formData.message.length > 50 ? '...' : ''),
      }
      setEventLogs([newLog, ...eventLogs])

      // Show success message
      setShowSuccess(true)
      setTimeout(() => setShowSuccess(false), 3000)

      // Clear form
      setFormData({
        ...formData,
        message: '',
        subject: '',
      })
    } catch (err: any) {
      const newLog: EventLog = {
        id: Date.now().toString(),
        userId: formData.userId,
        type: formData.type,
        notificationType: formData.notificationType,
        channel: formData.channel,
        status: 'error',
        timestamp: new Date().toISOString(),
        error: err.message,
      }
      setEventLogs([newLog, ...eventLogs])
      setError(err.message || 'Failed to send event')
    } finally {
      setSending(false)
    }
  }

  const channelIcon = (channel: string) => {
    if (channel === 'email') return Mail
    if (channel === 'sms') return MessageSquare
    return Bell
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
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
        {/* Success Banner */}
        {showSuccess && (
          <div className="bg-success-50 border border-success-200 text-success-700 p-4 rounded-lg flex items-center gap-3">
            <CheckCircle size={20} />
            <span className="font-medium">Event sent successfully!</span>
          </div>
        )}

        {/* Event Types Info */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <div className="flex items-start gap-3">
              <div className="stat-icon-wrap bg-danger-100">
                <Zap size={18} className="text-danger-700" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">Immediate</div>
                <div className="text-sm text-slate-500 mt-1">Send notification right now (transactional)</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-start gap-3">
              <div className="stat-icon-wrap bg-primary-100">
                <Calendar size={18} className="text-primary-700" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">Optimized</div>
                <div className="text-sm text-slate-500 mt-1">ML schedules at best time (marketing)</div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="flex items-start gap-3">
              <div className="stat-icon-wrap bg-slate-100">
                <Bell size={18} className="text-slate-600" />
              </div>
              <div>
                <div className="font-semibold text-slate-900">Analytics Only</div>
                <div className="text-sm text-slate-500 mt-1">Track event, don't send notification</div>
              </div>
            </div>
          </div>
        </div>

        {/* Send Event Form */}
        <div className="card" id="event-form">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Send Notification Event</h3>

          <form onSubmit={handleSendEvent} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* User ID */}
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
                  disabled={sending}
                  required
                />
                <p className="text-xs text-slate-500 mt-1">User will be auto-created if doesn't exist</p>
              </div>

              {/* Event Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Event Type</label>
                <select
                  className="input"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  disabled={sending}
                >
                  <option value="NOTIFICATION">NOTIFICATION</option>
                  <option value="PURCHASE">PURCHASE</option>
                  <option value="APPOINTMENT">APPOINTMENT</option>
                  <option value="REMINDER">REMINDER</option>
                  <option value="ALERT">ALERT</option>
                  <option value="CUSTOM">CUSTOM</option>
                </select>
              </div>

              {/* Email (optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email (optional)</label>
                <input
                  type="email"
                  className="input"
                  placeholder="user@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={sending}
                />
                <p className="text-xs text-slate-500 mt-1">Required if user doesn't exist</p>
              </div>

              {/* Phone (optional) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone (optional)</label>
                <input
                  type="tel"
                  className="input"
                  placeholder="+14155551234"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={sending}
                />
                <p className="text-xs text-slate-500 mt-1">E.164 format (+1XXXXXXXXXX)</p>
              </div>

              {/* Notification Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Notification Type <span className="text-danger-600">*</span>
                </label>
                <select
                  className="input"
                  value={formData.notificationType}
                  onChange={(e) => setFormData({ ...formData, notificationType: e.target.value })}
                  disabled={sending}
                  required
                >
                  <option value="immediate">Immediate (send now)</option>
                  <option value="optimized">Optimized (ML scheduling)</option>
                  <option value="">Analytics only (no notification)</option>
                </select>
              </div>

              {/* Channel */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Channel <span className="text-danger-600">*</span>
                </label>
                <select
                  className="input"
                  value={formData.channel}
                  onChange={(e) => setFormData({ ...formData, channel: e.target.value })}
                  disabled={sending}
                  required
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push (future)</option>
                </select>
              </div>
            </div>

            {/* Subject (for email) */}
            {formData.channel === 'email' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Subject {formData.notificationType && <span className="text-danger-600">*</span>}
                </label>
                <input
                  type="text"
                  className="input"
                  placeholder="Your order has shipped!"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  disabled={sending}
                  required={formData.channel === 'email' && formData.notificationType !== ''}
                />
              </div>
            )}

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Message {formData.notificationType && <span className="text-danger-600">*</span>}
              </label>
              <textarea
                className="input"
                rows={4}
                placeholder="Your order #12345 has been shipped and will arrive in 2-3 business days."
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                disabled={sending}
                required={formData.notificationType !== ''}
              />
              <p className="text-xs text-slate-500 mt-1">
                {formData.message.length} characters
                {formData.channel === 'sms' && formData.message.length > 160 && (
                  <span className="text-warning-600 ml-2">⚠ SMS messages over 160 chars may be split</span>
                )}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-danger-50 border border-danger-200 text-danger-700 text-sm p-3 rounded-lg flex items-start gap-2">
                <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Submit */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setFormData({
                  userId: '',
                  email: '',
                  phone: '',
                  type: 'NOTIFICATION',
                  notificationType: 'immediate',
                  channel: 'email',
                  message: '',
                  subject: '',
                })}
                className="btn-secondary"
                disabled={sending}
              >
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

        {/* Event Log */}
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
                      <div className="flex items-start gap-3 flex-1">
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
                            <span className="text-slate-400">→</span>
                            <span className="badge badge-neutral text-xs">{log.type}</span>
                            <span className="badge badge-info text-xs">{log.notificationType}</span>
                            <span className="flex items-center gap-1 text-xs text-slate-600">
                              <ChannelIcon size={12} />
                              {log.channel}
                            </span>
                          </div>
                          {log.message && (
                            <p className="text-sm text-slate-600 mt-1 truncate">{log.message}</p>
                          )}
                          {log.error && (
                            <p className="text-sm text-danger-700 mt-1">{log.error}</p>
                          )}
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

        {/* Help Text */}
        <div className="card bg-blue-50 border-blue-200">
          <h4 className="font-semibold text-slate-900 mb-2">💡 How It Works</h4>
          <ul className="text-sm text-slate-600 space-y-1">
            <li>
              <strong>Immediate:</strong> Notification sent instantly via Sender Lambda
            </li>
            <li>
              <strong>Optimized:</strong> Decision Service predicts best send time using ML model (24-hour window)
            </li>
            <li>
              <strong>Analytics Only:</strong> Event tracked in S3 for ML training, no notification sent
            </li>
            <li>
              <strong>Auto-User Creation:</strong> If user doesn't exist, profile created automatically with
              provided contact info
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

export default Events
