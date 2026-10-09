import { useState, useEffect } from 'react'
import { TrendingDown, ShieldCheck, MapPin, Activity, AlertOctagon, Flame, Siren } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/app/services/api'
import { useAuth } from '@/app/hooks/useAuth'

const TOOLTIP_STYLE = {
  background: 'rgba(15,23,42,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  color: '#f1f5f9',
  fontSize: 12,
  boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
}

function titleCase(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatDay(day: string) {
  return new Date(`${day}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}

export default function Dashboard() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    hotspot_count: 0,
    critical_hotspot_count: 0,
    total_incidents: 0,
    active_sos_alerts: 0,
    resolved_incidents: 0,
    crime_reduction_pct: 0,
  })
  const [incidentStats, setIncidentStats] = useState<Awaited<ReturnType<typeof api.getIncidentStats>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [holdoutR2, setHoldoutR2] = useState<number | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    api.getMLMetrics(controller.signal)
      .then((m) => setHoldoutR2(m.holdout_r2 ?? null))
      .catch(() => setHoldoutR2(null))
    // Incident statistics are police/admin only on the backend. Requesting
    // them as a citizen rejected the whole Promise.all, so the dashboard's
    // own stats never loaded for citizens.
    const canSeeIncidentStats = user?.role === 'police' || user?.role === 'admin' || user?.role === 'super_admin'
    Promise.all([
      api.getDashboardStats(controller.signal),
      canSeeIncidentStats ? api.getIncidentStats(controller.signal) : Promise.resolve(null),
    ])
      .then(([dashboardData, incidentData]) => {
        setStats({
          ...dashboardData,
          critical_hotspot_count: dashboardData.critical_hotspot_count ?? 0,
        })
        setIncidentStats(incidentData)
      })
      .catch(e => { if (e.name !== 'AbortError') console.error('Dashboard stats error:', e) })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [user?.role])

  const trendData = (incidentStats?.timeline_7d ?? []).map((row) => ({
    day: formatDay(row.day),
    incidents: row.count,
    resolved: row.resolved ?? 0,
  }))

  const typeData = (incidentStats?.by_type ?? []).map((row) => ({
    name: titleCase(row.type),
    incidents: row.count,
  }))

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Main Analytics Dashboard
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            Crime risk overview for India
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatPill
            icon={<TrendingDown className="text-emerald-400 w-5 h-5" />}
            label="Crime Reduction"
            value={loading ? '...' : `-${stats.crime_reduction_pct}%`}
            accent="emerald"
          />
            <StatPill
              icon={<ShieldCheck className="text-indigo-400 w-5 h-5" />}
            label="Holdout R2"
            value={holdoutR2 === null ? '—' : holdoutR2.toFixed(3)}
            accent="indigo"
          />
          <StatPill
            icon={<MapPin className="text-sky-400 w-5 h-5" />}
            label="Geocoded Districts"
            value={loading ? '...' : String(stats.hotspot_count)}
            accent="sky"
          />
        </div>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          label="Total Hotspots"
          value={loading ? '...' : stats.hotspot_count}
          icon={<Flame className="w-5 h-5" />}
          color="indigo"
        />
          <StatCard
            label="Critical Zones"
          value={loading ? '...' : stats.critical_hotspot_count}
          icon={<AlertOctagon className="w-5 h-5" />}
          color="red"
        />
        <StatCard
          label="Incidents Reported"
          value={loading ? '...' : stats.total_incidents}
          icon={<Activity className="w-5 h-5" />}
          color="amber"
        />
        <StatCard
          label="Active SOS Alerts"
          value={loading ? '...' : stats.active_sos_alerts}
          icon={<Siren className="w-5 h-5" />}
          color="emerald"
        />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <ChartCard
          title="Incident Trend"
          subtitle="Reported vs resolved incidents from the database"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="incidents" stroke="#818cf8" fill="url(#gradActual)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="resolved" stroke="#38bdf8" fill="url(#gradResolved)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Crime Types" subtitle="Incident distribution from reported records">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={typeData} margin={{ left: 0, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(99,102,241,0.08)' }} />
              <Bar dataKey="incidents" name="Incidents" fill="#6366f1" radius={[6,6,0,0]} barSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <p className="text-xs text-slate-500 text-right">
        Data Source: NCRB district-year crime data, 2010-2024 • Geocoded district coverage only
      </p>
    </div>
  )
}

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string; glow: string }> = {
  indigo:  { bg: 'rgba(99,102,241,0.12)',  text: '#a5b4fc', ring: 'rgba(99,102,241,0.25)',  glow: 'rgba(99,102,241,0.3)'  },
  red:     { bg: 'rgba(239,68,68,0.12)',   text: '#fca5a5', ring: 'rgba(239,68,68,0.25)',   glow: 'rgba(239,68,68,0.3)'   },
  amber:   { bg: 'rgba(245,158,11,0.12)',  text: '#fcd34d', ring: 'rgba(245,158,11,0.25)',  glow: 'rgba(245,158,11,0.3)'  },
  emerald: { bg: 'rgba(16,185,129,0.12)',  text: '#6ee7b7', ring: 'rgba(16,185,129,0.25)',  glow: 'rgba(16,185,129,0.3)'  },
  sky:     { bg: 'rgba(56,189,248,0.12)',  text: '#7dd3fc', ring: 'rgba(56,189,248,0.25)',  glow: 'rgba(56,189,248,0.3)'  },
}

function StatCard({ label, value, icon, color }: { label: string; value: number | string; icon: React.ReactNode; color: string }) {
  const c = COLOR_MAP[color] ?? COLOR_MAP.indigo
  return (
    <div
      className="relative overflow-hidden rounded-2xl p-4 sm:p-5 border transition-all hover:scale-[1.02] hover:-translate-y-0.5"
      style={{
        background: `linear-gradient(135deg, ${c.bg} 0%, rgba(15,23,42,0.4) 100%)`,
        borderColor: c.ring,
        boxShadow: `0 4px 24px rgba(0,0,0,0.3), 0 0 0 1px ${c.ring}`,
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{label}</p>
        <div className="p-1.5 rounded-lg" style={{ background: c.bg, color: c.text }}>
          {icon}
        </div>
      </div>
      <p className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: c.text }}>
        {value}
      </p>
    </div>
  )
}

function StatPill({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  const c = COLOR_MAP[accent] ?? COLOR_MAP.indigo
  return (
    <div
      className="px-4 py-2.5 rounded-xl border flex items-center gap-3 min-w-[160px]"
      style={{
        background: 'rgba(15,23,42,0.5)',
        borderColor: 'rgba(255,255,255,0.06)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="p-1.5 rounded-lg shrink-0" style={{ background: c.bg }}>{icon}</div>
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-base font-bold text-white leading-tight mt-0.5">{value}</p>
      </div>
    </div>
  )
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl p-5 sm:p-6 border"
      style={{
        background: 'linear-gradient(180deg, rgba(30,41,59,0.6) 0%, rgba(15,23,42,0.6) 100%)',
        borderColor: 'rgba(255,255,255,0.06)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(8px)',
      }}
    >
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-bold text-white text-base">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
        </div>
      </div>
      <div className="h-[280px]">{children}</div>
    </div>
  )
}
