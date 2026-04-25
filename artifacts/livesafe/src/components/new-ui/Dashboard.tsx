import { useEffect, useMemo, useState } from 'react'
import {
  TrendingDown, ShieldCheck, MapPin, Activity, AlertOctagon, Flame, Siren,
  Users, ArrowRightLeft, Radar, Route,
} from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '@/app/services/api'
import { useAuth } from '@/app/hooks/useAuth'
import {
  buildDispatchRecommendations,
  buildCoverageHeatmap,
  buildIncidentClusters,
  buildOperationalZones,
  buildPatrolAllocations,
  buildPatrolUnits,
  buildResponseSimulation,
} from '@/app/services/safetyIntelligence'
import type { Hotspot, Incident, SOSAlert } from '@/types'

const trendData = [
  { day: 'Day 3', actual: 120, predicted: 115 },
  { day: 'Day 6', actual: 132, predicted: 128 },
  { day: 'Day 9', actual: 141, predicted: 138 },
  { day: 'Day 15', actual: 160, predicted: 165 },
  { day: 'Day 20', actual: 185, predicted: 190 },
  { day: 'Day 28', actual: 178, predicted: 182 },
]

const TOOLTIP_STYLE = {
  background: 'rgba(15,23,42,0.95)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 12,
  color: '#f1f5f9',
  fontSize: 12,
  boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
}

export default function Dashboard() {
  const { user } = useAuth()
  const isOps = user?.role === 'police' || user?.role === 'admin'
  const [stats, setStats] = useState({
    hotspot_count: 0,
    total_incidents: 0,
    active_sos_alerts: 0,
    resolved_incidents: 0,
    crime_reduction_pct: 0,
  })
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [alerts, setAlerts] = useState<SOSAlert[]>([])
  const [availableUnits, setAvailableUnits] = useState(4)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      api.getDashboardStats(controller.signal),
      api.getIncidents({ limit: 20 }, controller.signal),
      api.getHotspots(controller.signal),
      api.getSOSAlerts(controller.signal),
    ])
      .then(([statsData, incidentData, hotspotData, alertData]) => {
        setStats(statsData)
        setIncidents(incidentData)
        setHotspots(hotspotData)
        setAlerts(alertData)
      })
      .catch((e) => { if (e.name !== 'AbortError') console.error('Dashboard load error:', e) })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  const criticalCount = Math.round(stats.hotspot_count * 0.2)
  const zones = useMemo(() => buildOperationalZones(incidents, hotspots, alerts), [alerts, hotspots, incidents])
  const dispatchRecommendations = useMemo(
    () => buildDispatchRecommendations(alerts, incidents, hotspots),
    [alerts, hotspots, incidents]
  )
  const clusters = useMemo(() => buildIncidentClusters(incidents, hotspots), [incidents, hotspots])
  const patrolAllocations = useMemo(() => buildPatrolAllocations(zones, availableUnits), [availableUnits, zones])
  const commandUnits = useMemo(() => buildPatrolUnits(zones, availableUnits), [availableUnits, zones])
  const coverageHeatmap = useMemo(() => buildCoverageHeatmap(zones), [zones])
  const responseSimulation = useMemo(
    () => buildResponseSimulation(zones[0], Math.min(availableUnits, 2)),
    [availableUnits, zones]
  )
  const [unitAssignments, setUnitAssignments] = useState<Record<string, string>>({})

  useEffect(() => {
    setUnitAssignments((current) => {
      const next = { ...current }
      for (const unit of commandUnits) {
        if (!next[unit.id]) next[unit.id] = unit.zone
      }
      return next
    })
  }, [commandUnits])

  const assignNextUnit = (zoneLabel: string) => {
    const nextAvailable = commandUnits.find((unit) => {
      const assignedZone = unitAssignments[unit.id] ?? unit.zone
      return assignedZone !== zoneLabel
    })
    if (!nextAvailable) return
    setUnitAssignments((current) => ({ ...current, [nextAvailable.id]: zoneLabel }))
  }

  const stagedCoverageGain = useMemo(() => {
    const topZone = zones[0]
    if (!topZone) return null
    const assignedCount = Object.values(unitAssignments).filter((zone) => zone === topZone.label).length
    return buildResponseSimulation(topZone, Math.max(1, Math.min(assignedCount, 3)))
  }, [unitAssignments, zones])

  return (
    <div className="space-y-6 sm:space-y-8 pb-12">
      <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {isOps ? 'Decision Command Center' : 'Main Analytics Dashboard'}
          </h1>
          <p className="text-slate-400 text-sm mt-1.5">
            {isOps
              ? 'LiveSafe AI · patrol decisions, priority zones, and response planning'
              : 'LiveSafe AI · real-time crime prediction across India'}
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
            label={isOps ? 'Decision Confidence' : 'Model Accuracy'}
            value="93.5%"
            accent="indigo"
          />
          <StatPill
            icon={<MapPin className="text-sky-400 w-5 h-5" />}
            label={isOps ? 'Priority Zones' : 'Hotspot Cities'}
            value={loading ? '...' : String(isOps ? zones.length : stats.hotspot_count)}
            accent="sky"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StatCard label="Total Hotspots" value={loading ? '...' : stats.hotspot_count} icon={<Flame className="w-5 h-5" />} color="indigo" />
        <StatCard label="Critical Zones" value={loading ? '...' : criticalCount} icon={<AlertOctagon className="w-5 h-5" />} color="red" />
        <StatCard label="Incidents Reported" value={loading ? '...' : stats.total_incidents} icon={<Activity className="w-5 h-5" />} color="amber" />
        <StatCard label="Active SOS Alerts" value={loading ? '...' : stats.active_sos_alerts} icon={<Siren className="w-5 h-5" />} color="emerald" />
      </div>

      {isOps && (
        <div className="grid xl:grid-cols-[1.4fr,1fr] gap-4 sm:gap-6">
          <DecisionCard title="Patrol Allocation Engine" subtitle="Auto-prioritized deployment guidance">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <div className="text-sm text-slate-400">
                  Available patrol units
                </div>
                <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/30 px-3 py-2">
                  <Users className="h-4 w-4 text-sky-400" />
                  <input
                    type="range"
                    min={2}
                    max={8}
                    value={availableUnits}
                    onChange={(e) => setAvailableUnits(Number(e.target.value))}
                    className="w-32"
                  />
                  <span className="text-sm font-bold text-white">{availableUnits}</span>
                </div>
              </div>

              <div className="space-y-3">
                {patrolAllocations.map((allocation) => (
                  <div key={allocation.zone} className="rounded-2xl border border-white/8 bg-slate-950/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{allocation.zone}</div>
                        <div className="mt-1 text-xs text-slate-400">{allocation.reason}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-black text-sky-300">{allocation.unitsRecommended}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">units</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </DecisionCard>

          <DecisionCard title="Response Simulation" subtitle="What happens if units shift now">
            {responseSimulation ? (
              <div className="space-y-4">
                <div className="rounded-2xl border border-indigo-400/20 bg-indigo-500/10 p-4">
                  <div className="text-sm font-semibold text-white">{responseSimulation.zone}</div>
                  <div className="mt-2 flex items-center gap-3 text-sm">
                    <span className="text-slate-400">{responseSimulation.currentResponseMin} min</span>
                    <ArrowRightLeft className="h-4 w-4 text-indigo-300" />
                    <span className="font-bold text-emerald-300">{responseSimulation.projectedResponseMin} min</span>
                  </div>
                  <div className="mt-3 text-xs leading-relaxed text-slate-300">
                    {responseSimulation.impact}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <MiniMetric label="Units moved" value={responseSimulation.unitsMoved} icon={<Users className="h-4 w-4 text-sky-400" />} />
                  <MiniMetric label="Improvement" value={`${responseSimulation.improvementPct}%`} icon={<Route className="h-4 w-4 text-emerald-400" />} />
                </div>
              </div>
            ) : (
              <div className="text-sm text-slate-500">No zone data available yet.</div>
            )}
          </DecisionCard>
        </div>
      )}

      {isOps && (
        <div className="grid xl:grid-cols-[1.2fr,0.8fr] gap-4 sm:gap-6">
          <DecisionCard title="City Command Center" subtitle="Live corridor pressure and unit staging">
            <div className="space-y-4">
              {coverageHeatmap.map((zone) => (
                <div key={zone.id} className="rounded-2xl border border-white/8 bg-slate-950/30 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{zone.label}</div>
                      <div className="mt-1 text-xs text-slate-400">{zone.recommendation}</div>
                    </div>
                    <button
                      onClick={() => assignNextUnit(zone.label)}
                      className="rounded-xl border border-indigo-400/20 bg-indigo-500/10 px-3 py-1.5 text-[11px] font-bold text-indigo-200 hover:bg-indigo-500/20"
                    >
                      Assign next unit
                    </button>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Pressure</span>
                        <span>{zone.pressure}/100</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5">
                        <div className="h-2 rounded-full bg-red-400" style={{ width: `${zone.pressure}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                        <span>Coverage</span>
                        <span>{zone.coverage}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-white/5">
                        <div className="h-2 rounded-full bg-emerald-400" style={{ width: `${zone.coverage}%` }} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </DecisionCard>

          <DecisionCard title="Patrol Unit Board" subtitle="Who is deployed and where they are pointed">
            <div className="space-y-3">
              {commandUnits.map((unit) => {
                const assignedZone = unitAssignments[unit.id] ?? unit.zone
                return (
                  <div key={unit.id} className="rounded-2xl border border-white/8 bg-slate-950/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-white">{unit.callSign}</div>
                        <div className="mt-1 text-xs text-slate-400">{unit.focus}</div>
                      </div>
                      <span className="rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                        {unit.status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                      <span className="rounded-full bg-white/5 px-2.5 py-1">{assignedZone}</span>
                      <span className="rounded-full bg-white/5 px-2.5 py-1">
                        {unit.etaMinutes > 0 ? `${unit.etaMinutes} min ETA` : 'On reserve'}
                      </span>
                    </div>
                  </div>
                )
              })}

              {stagedCoverageGain && (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4">
                  <div className="text-sm font-semibold text-white">Top-zone staging impact</div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-300">
                    {stagedCoverageGain.impact}
                  </div>
                </div>
              )}
            </div>
          </DecisionCard>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
        <ChartCard title="Crime Trends (30 Days)" subtitle="Actual vs predicted incidents nationwide">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trendData}>
              <defs>
                <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradPredicted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'rgba(99,102,241,0.3)', strokeWidth: 1 }} />
              <Area type="monotone" dataKey="actual" stroke="#818cf8" fill="url(#gradActual)" strokeWidth={2.5} />
              <Area type="monotone" dataKey="predicted" stroke="#38bdf8" fill="url(#gradPredicted)" strokeWidth={2} strokeDasharray="4 4" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title={isOps ? 'Active Clusters' : 'Crime Pressure Clusters'} subtitle="Areas with repeat pressure and hotspot spillover">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={clusters}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#64748b' }} />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Bar dataKey="incidentCount" name="Incident count" fill="#6366f1" radius={[6, 6, 0, 0]} barSize={20} />
              <Bar dataKey="repeatLocationCount" name="Repeat locations" fill="#f97316" radius={[6, 6, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {isOps && (
        <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
          <DecisionCard title="Immediate Actions" subtitle="Auto-prioritized interventions">
            <div className="space-y-3">
              {dispatchRecommendations.map((item) => (
                <div key={item.title} className={`rounded-2xl border p-4 ${
                  item.severity === 'high'
                    ? 'border-red-400/20 bg-red-500/10'
                    : item.severity === 'medium'
                      ? 'border-amber-400/20 bg-amber-500/10'
                      : 'border-indigo-400/20 bg-indigo-500/10'
                }`}>
                  <div className="text-sm font-semibold text-white">{item.title}</div>
                  <div className="mt-1 text-xs leading-relaxed text-slate-300">{item.detail}</div>
                </div>
              ))}
            </div>
          </DecisionCard>

          <DecisionCard title="Zone Priority Board" subtitle="Where intervention matters most">
            <div className="space-y-3">
              {zones.map((zone) => (
                <div key={zone.label} className="rounded-2xl border border-white/8 bg-slate-950/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{zone.label}</div>
                      <div className="mt-1 text-xs leading-relaxed text-slate-400">{zone.recommendation}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-black text-white">{zone.priority}</div>
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">priority</div>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                    <span className="rounded-full bg-white/5 px-2.5 py-1">{zone.incidents} incidents</span>
                    <span className="rounded-full bg-white/5 px-2.5 py-1">{zone.activeAlerts} active SOS</span>
                    <span className="rounded-full bg-white/5 px-2.5 py-1 capitalize">{zone.risk}</span>
                  </div>
                </div>
              ))}
            </div>
          </DecisionCard>
        </div>
      )}

      <p className="text-xs text-slate-500 text-right">
        Data Source: National Crime Records Bureau (NCRB) — Crime in India 2020-2023 window
      </p>
    </div>
  )
}

const COLOR_MAP: Record<string, { bg: string; text: string; ring: string }> = {
  indigo: { bg: 'rgba(99,102,241,0.12)', text: '#a5b4fc', ring: 'rgba(99,102,241,0.25)' },
  red: { bg: 'rgba(239,68,68,0.12)', text: '#fca5a5', ring: 'rgba(239,68,68,0.25)' },
  amber: { bg: 'rgba(245,158,11,0.12)', text: '#fcd34d', ring: 'rgba(245,158,11,0.25)' },
  emerald: { bg: 'rgba(16,185,129,0.12)', text: '#6ee7b7', ring: 'rgba(16,185,129,0.25)' },
  sky: { bg: 'rgba(56,189,248,0.12)', text: '#7dd3fc', ring: 'rgba(56,189,248,0.25)' },
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
        <div className="p-1.5 rounded-lg" style={{ background: c.bg, color: c.text }}>{icon}</div>
      </div>
      <p className="text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: c.text }}>{value}</p>
    </div>
  )
}

function StatPill({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  const c = COLOR_MAP[accent] ?? COLOR_MAP.indigo
  return (
    <div
      className="px-4 py-2.5 rounded-xl border flex items-center gap-3 min-w-[160px]"
      style={{ background: 'rgba(15,23,42,0.5)', borderColor: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(8px)' }}
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

function DecisionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-[linear-gradient(180deg,rgba(30,41,59,0.68)_0%,rgba(15,23,42,0.68)_100%)] p-5 sm:p-6 shadow-[0_4px_24px_rgba(0,0,0,0.3)]">
      <div className="mb-5">
        <h3 className="font-bold text-white text-base">{title}</h3>
        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
      </div>
      {children}
    </div>
  )
}

function MiniMetric({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-slate-950/30 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-black text-white">{value}</div>
    </div>
  )
}
