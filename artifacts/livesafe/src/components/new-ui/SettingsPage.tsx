import React, { useMemo, useState } from 'react'
import {
  User, Database, Bell, Users, FileText, Key, Settings as SettingsIcon,
  Shield, Eye, LogOut, Phone,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/app/hooks/useAuth'
import EmergencyContactsCard from '@/components/EmergencyContactsCard'

const NAV_ITEMS = [
  { icon: <User />, label: 'Profile' },
  { icon: <Database />, label: 'Data Sources' },
  { icon: <Bell />, label: 'Notifications' },
  { icon: <Users />, label: 'Team Permissions' },
  { icon: <FileText />, label: 'System Logs' },
  { icon: <Key />, label: 'API Keys' },
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
  const { user, logout } = useAuth()
  const isCitizen = user?.role === 'citizen'
  const dataMode = useMemo(() => {
    const useMock = import.meta.env.VITE_USE_MOCK
    if (useMock === 'true') return 'Demo / mock mode'
    if (useMock === 'false') return 'Live data with local fallback'
    return 'Auto mode'
  }, [])

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">Settings</h1>
        <p className="text-slate-400 text-sm mt-1.5">Manage your account, safety preferences, and platform configuration</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        <div className="w-full lg:w-72 rounded-2xl border p-3 lg:p-4 space-y-1 shrink-0 lg:self-start" style={CARD_STYLE}>
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => setActiveTab(item.label)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                activeTab === item.label ? 'text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white',
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
              {React.isValidElement<{ className?: string }>(item.icon)
                ? React.cloneElement(item.icon, { className: 'w-4.5 h-4.5' })
                : item.icon}
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex-1 min-w-0">
          {activeTab === 'Profile' && (
            <div className="rounded-2xl border p-6 sm:p-8 space-y-6" style={CARD_STYLE}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-indigo-500/20 border-2 border-indigo-400/30 flex items-center justify-center text-2xl font-bold text-indigo-300">
                  {user?.name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{user?.name ?? 'Unknown user'}</h2>
                  <p className="text-sm text-slate-400">{user?.email ?? '—'}</p>
                  <div className="inline-flex mt-2 rounded-full bg-indigo-500/15 border border-indigo-400/25 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-300">
                    {user?.role ?? 'user'}
                  </div>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="Full Name" value={user?.name ?? '—'} />
                <Field label="Email Address" value={user?.email ?? '—'} />
                <Field label="Role" value={user?.role ?? '—'} />
                <Field label="Account ID" value={user?.id ?? '—'} mono />
                <Field label="Phone" value={user?.phone ?? 'Not added'} icon={<Phone className="w-3.5 h-3.5" />} />
                <Field label="Badge Number" value={user?.badge_number ?? 'Not applicable'} />
              </div>

              {isCitizen && (
                <EmergencyContactsCard
                  title="Safety Contacts"
                  description="Manage the trusted contacts used by your SOS flow."
                />
              )}
            </div>
          )}

          {activeTab === 'Data Sources' && (
            <div className="rounded-2xl border p-6 sm:p-8 space-y-4" style={CARD_STYLE}>
              <h2 className="text-xl font-bold text-white">Data Sources</h2>
              <InfoRow label="Hotspot model" value="NCRB-derived v5 India risk dataset" />
              <InfoRow label="Prediction engine" value="LiveSafe v5 ensemble with explainability and route intelligence" />
              <InfoRow label="Runtime mode" value={dataMode} />
              <InfoRow label="Fallback policy" value="Uses local model intelligence when backend endpoints are unavailable" />
            </div>
          )}

          {activeTab === 'Notifications' && (
            <div className="rounded-2xl border p-6 sm:p-8 space-y-3" style={CARD_STYLE}>
              <h2 className="text-xl font-bold text-white">Notifications</h2>
              <Toggle label="Critical incident alerts" defaultOn />
              <Toggle label="SOS alert updates" defaultOn />
              <Toggle label="High-risk prediction warnings" defaultOn />
              <Toggle label="System maintenance updates" />
            </div>
          )}

          {activeTab === 'Team Permissions' && (
            <div className="rounded-2xl border p-6 sm:p-8 space-y-4" style={CARD_STYLE}>
              <h2 className="text-xl font-bold text-white">Team Permissions</h2>
              <InfoRow label="Citizen role" value="Can report incidents, view risk, manage SOS contacts, and run predictions" />
              <InfoRow label="Police role" value="Can view SOS queue, response guidance, corridor priorities, and analytics" />
              <InfoRow label="Admin role" value="Can access ML dashboard, user management, and decision platform views" />
            </div>
          )}

          {activeTab === 'System Logs' && (
            <div className="rounded-2xl border p-6 sm:p-8 space-y-4" style={CARD_STYLE}>
              <h2 className="text-xl font-bold text-white">System Logs</h2>
              <InfoRow label="Frontend build" value="Latest upgraded UI compiled successfully" />
              <InfoRow label="Fallback handling" value="Non-JSON backend responses are caught and routed to local fallbacks" />
              <InfoRow label="Operational note" value="Some advanced actions still rely on frontend intelligence until backend services are wired" />
            </div>
          )}

          {activeTab === 'API Keys' && (
            <div className="rounded-2xl border p-6 sm:p-8 space-y-4" style={CARD_STYLE}>
              <h2 className="text-xl font-bold text-white">API & Integration Status</h2>
              <InfoRow label="App version" value={__APP_VERSION__} />
              <InfoRow label="Build time" value={new Date(__BUILD_TIME__).toLocaleString()} />
              <InfoRow label="Environment" value={import.meta.env.MODE} />
              <InfoRow label="Supabase" value={import.meta.env.VITE_SUPABASE_URL ? 'Configured' : 'Not configured'} />
            </div>
          )}

          {activeTab === 'General' && (
            <div className="rounded-2xl border p-6 sm:p-8 space-y-5" style={CARD_STYLE}>
              <h2 className="text-xl font-bold text-white">General</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <SummaryCard
                  icon={<Shield className="w-4 h-4 text-emerald-300" />}
                  title="Safety-ready"
                  text="SOS network, route guidance, and safety contacts are active in the citizen flow."
                />
                <SummaryCard
                  icon={<Eye className="w-4 h-4 text-sky-300" />}
                  title="Visibility"
                  text="Police and admin users get decision-oriented views with patrol and zone guidance."
                />
              </div>

              <button
                onClick={logout}
                className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/15 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, mono, icon }: { label: string; value: string; mono?: boolean; icon?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <div
        className={cn('px-3.5 py-2.5 rounded-lg border text-sm text-slate-200', mono && 'font-mono text-xs')}
        style={{ background: 'rgba(15,23,42,0.6)', borderColor: 'rgba(255,255,255,0.06)' }}
      >
        {value}
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-white/5 bg-slate-950/25 px-4 py-3">
      <span className="text-sm text-slate-400">{label}</span>
      <span className="text-sm font-medium text-slate-200">{value}</span>
    </div>
  )
}

function Toggle({ label, defaultOn = false }: { label: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <button
      onClick={() => setOn((v) => !v)}
      className="w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm text-slate-200 hover:bg-white/5 transition-all"
      style={{ background: 'rgba(15,23,42,0.4)', borderColor: 'rgba(255,255,255,0.06)' }}
    >
      <span>{label}</span>
      <span
        className="relative w-10 h-5.5 rounded-full transition-colors shrink-0"
        style={{ background: on ? 'rgba(99,102,241,0.7)' : 'rgba(100,116,139,0.4)', height: 22, width: 40 }}
      >
        <span className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all" style={{ left: on ? 22 : 2 }} />
      </span>
    </button>
  )
}

function SummaryCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/25 p-4">
      <div className="flex items-center gap-2 text-white font-semibold text-sm">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">{text}</p>
    </div>
  )
}
