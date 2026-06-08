import { useState } from 'react'
import Layout from '@/components/common/Layout'
import { useAuth } from '@/contexts/AuthContext'
import {
  User,
  Globe,
  Moon,
  Bell,
  Mail,
  MessageSquare,
  Smartphone,
  Save,
  CheckCircle2,
  Shield,
  Key,
} from 'lucide-react'

interface ChannelDef {
  key: 'email' | 'sms' | 'push' | 'whatsapp'
  label: string
  icon: any
  desc: string
}

const channels: ChannelDef[] = [
  { key: 'email', label: 'Email', icon: Mail, desc: 'Transactional and marketing notifications' },
  { key: 'sms', label: 'SMS', icon: MessageSquare, desc: 'Critical alerts and verification codes' },
  { key: 'push', label: 'Push', icon: Bell, desc: 'Real-time mobile notifications' },
  { key: 'whatsapp', label: 'WhatsApp', icon: Smartphone, desc: 'Rich messages and confirmations' },
]

const Settings = () => {
  const { user } = useAuth()
  const [tz, setTz] = useState('Europe/Paris')
  const [quietStart, setQuietStart] = useState('22:00')
  const [quietEnd, setQuietEnd] = useState('07:00')
  const [enabled, setEnabled] = useState<Record<ChannelDef['key'], boolean>>({
    email: true,
    sms: true,
    push: true,
    whatsapp: false,
  })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    }, 600)
  }

  return (
    <Layout
      actions={
        saved && (
          <span className="badge badge-success">
            <CheckCircle2 size={12} /> Preferences saved
          </span>
        )
      }
    >
      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="card">
            <header className="flex items-center gap-2 mb-5">
              <div className="stat-icon-wrap bg-primary-100">
                <User size={16} className="text-primary-700" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Profile</h3>
                <p className="text-xs text-slate-500">Identity and location</p>
              </div>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Email</label>
                <input className="input" defaultValue={user?.email} disabled />
              </div>
              <div>
                <label className="label">Display name</label>
                <input
                  className="input"
                  placeholder="Your name"
                  defaultValue={user?.email?.split('@')[0]}
                />
              </div>
              <div className="md:col-span-2">
                <label className="label">Timezone</label>
                <select className="select" value={tz} onChange={(e) => setTz(e.target.value)}>
                  <option>Europe/Paris</option>
                  <option>Europe/London</option>
                  <option>America/New_York</option>
                  <option>America/Los_Angeles</option>
                  <option>Asia/Tokyo</option>
                </select>
              </div>
            </div>
          </section>

          <section className="card">
            <header className="flex items-center gap-2 mb-5">
              <div className="stat-icon-wrap bg-accent-100">
                <Bell size={16} className="text-accent-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Notification channels</h3>
                <p className="text-xs text-slate-500">Enable channels available for this user</p>
              </div>
            </header>
            <div className="space-y-3">
              {channels.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
                >
                  <div className="stat-icon-wrap bg-slate-100">
                    <c.icon size={16} className="text-slate-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900">{c.label}</div>
                    <div className="text-xs text-slate-500">{c.desc}</div>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled[c.key]}
                    onClick={() => setEnabled((p) => ({ ...p, [c.key]: !p[c.key] }))}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      enabled[c.key] ? 'bg-primary-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                        enabled[c.key] ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>
              ))}
            </div>
          </section>

          <section className="card">
            <header className="flex items-center gap-2 mb-5">
              <div className="stat-icon-wrap bg-warning-100">
                <Moon size={16} className="text-warning-700" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Quiet hours</h3>
                <p className="text-xs text-slate-500">
                  No notification will be sent during this window
                </p>
              </div>
            </header>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Start</label>
                <input
                  type="time"
                  className="input"
                  value={quietStart}
                  onChange={(e) => setQuietStart(e.target.value)}
                />
              </div>
              <div>
                <label className="label">End</label>
                <input
                  type="time"
                  className="input"
                  value={quietEnd}
                  onChange={(e) => setQuietEnd(e.target.value)}
                />
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">
              The ML model will automatically defer sends scheduled within this window to the next optimal slot.
            </p>
          </section>

          <div className="flex justify-end">
            <button type="submit" className="btn-primary" disabled={saving}>
              <Save size={16} />
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>

        <div className="space-y-6">
          <section className="card">
            <header className="flex items-center gap-2 mb-4">
              <Shield size={16} className="text-success-600" />
              <h3 className="text-sm font-semibold text-slate-900">Security</h3>
            </header>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="text-slate-600">Authentication</span>
                <span className="badge badge-success">Cognito · JWT</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-600">Token expiration</span>
                <span className="text-slate-900 font-medium">1 h</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-600">Encryption</span>
                <span className="badge badge-info">KMS auto-rotation</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="text-slate-600">Transport</span>
                <span className="badge badge-info">TLS 1.3</span>
              </li>
            </ul>
            <button type="button" className="btn-secondary w-full mt-4">
              <Key size={14} /> Change password
            </button>
          </section>

          <section className="card">
            <header className="flex items-center gap-2 mb-4">
              <Globe size={16} className="text-primary-600" />
              <h3 className="text-sm font-semibold text-slate-900">Platform</h3>
            </header>
            <ul className="space-y-2 text-sm text-slate-600">
              <li className="flex justify-between">
                <span>Region</span>
                <span className="font-medium text-slate-900">
                  {import.meta.env.VITE_REGION || 'us-west-2'}
                </span>
              </li>
              <li className="flex justify-between">
                <span>Version</span>
                <span className="font-medium text-slate-900">v1.0.0</span>
              </li>
              <li className="flex justify-between">
                <span>ML model</span>
                <span className="font-medium text-slate-900">XGBoost v2.4</span>
              </li>
              <li className="flex justify-between">
                <span>Mode</span>
                <span className="badge badge-info">
                  {import.meta.env.VITE_DEMO_MODE === 'true' ? 'Demo mode' : 'Production'}
                </span>
              </li>
            </ul>
          </section>
        </div>
      </form>
    </Layout>
  )
}

export default Settings
