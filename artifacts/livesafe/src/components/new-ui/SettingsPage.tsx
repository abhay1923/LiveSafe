import React, { useState } from 'react'
import { User, Database, Bell, Users, FileText, Key, Settings as SettingsIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/app/hooks/useAuth'

const NAV_ITEMS = [
  { icon: <User />,         label: 'Profile' },
  { icon: <Database />,     label: 'Data Sources' },
  { icon: <Bell />,         label: 'Notifications' },
  { icon: <Users />,        label: 'Team Permissions' },
  { icon: <FileText />,     label: 'System Logs' },
  { icon: <Key />,          label: 'API Keys' },
  { icon: <SettingsIcon />, label: 'General' },
]

const CARD_STYLE: React.CSSProperties = {
  background: 'linear-gradient(180deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.6) 100%)',
  borderColor: 'rgba(255,255,255,0.06)',
  boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
  backdropFilter: 'blur(8px)',
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('Profile')
  const { user } = useAuth()

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-slate-400 text-sm mt-1.5">Manage your account and platform preferences</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* Sidebar */}
        <div
          className="w-full lg:w-64 rounded-2xl border p-3 lg:p-4 space-y-1 shrink-0 lg:self-start"
          style={CARD_STYLE}
        >
          {NAV_ITEMS.map(item => (
            <button
              key={item.label}
              onClick={() => setActiveTab(item.label)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                activeTab === item.label
                  ? 'text-white'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white',
              )}
              style={
                activeTab === item.label
                  ? {
                      background: 'linear-gradient(135deg, rgba(99,102,241,0.25) 0%, rgba(139,92,246,0.15) 100%)',
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)',
                    }
                  : undefined
              }
            >
              {React.cloneElement(item.icon as React.ReactElement, { className: 'w-4.5 h-4.5' })}
              {item.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'Profile' && (
            <div className="rounded-2xl border p-6 sm:p-8" style={CARD_STYLE}>
              <h2 className="text-xl font-bold text-white mb-6">Profile Settings</h2>
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Full Name"     value={user?.name ?? '—'} />
                <Field label="Email Address" value={user?.email ?? '—'} />
                <Field label="Role"          value={user?.role ?? '—'} />
                <Field label="Account ID"    value={user?.id ?? '—'} mono />
              </div>
              <p className="text-xs text-slate-500 mt-6">
                Profile editing is read-only in this environment. Contact your administrator to update details.
              </p>
            </div>
          )}
          {activeTab === 'Notifications' && (
            <div className="rounded-2xl border p-6 sm:p-8" style={CARD_STYLE}>
              <h2 className="text-xl font-bold text-white mb-6">Notifications</h2>
              <div className="space-y-3">
                <Toggle label="Critical incident alerts"      defaultOn />
                <Toggle label="Daily digest email"            defaultOn />
                <Toggle label="High-risk prediction warnings" defaultOn />
                <Toggle label="System maintenance updates"    />
              </div>
            </div>
          )}
          {activeTab !== 'Profile' && activeTab !== 'Notifications' && (
            <div className="rounded-2xl border p-6 sm:p-8 text-center" style={CARD_STYLE}>
              <h2 className="text-xl font-bold text-white mb-2">{activeTab}</h2>
              <p className="text-slate-400 text-sm">This section is coming soon.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5">{label}</p>
      <div
        className={cn(
          'px-3.5 py-2.5 rounded-lg border text-sm text-slate-200',
          mono && 'font-mono text-xs',
        )}
        style={{ background: 'rgba(15,23,42,0.6)', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        {value}
      </div>
    </div>
  )
}

function Toggle({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button
      onClick={() => setOn(v => !v)}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm text-slate-200 hover:bg-white/5 transition-all"
      style={{ background: 'rgba(15,23,42,0.4)', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <span>{label}</span>
      <span
        className="relative w-10 h-5.5 rounded-full transition-colors shrink-0"
        style={{ background: on ? 'rgba(99,102,241,0.7)' : 'rgba(100,116,139,0.4)', height: 22, width: 40 }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all"
          style={{ left: on ? 22 : 2 }}
        />
      </span>
    </button>
  )
}
