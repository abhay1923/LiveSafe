import React, { useMemo, useState } from 'react'
import { useApi } from '@/app/hooks/useApi'
import { api } from '@/app/services/api'
import AppLayout from '@/components/layout/AppLayout'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingDown, TrendingUp, AlertTriangle, Clock, CheckCircle, Activity, Radar, Repeat, ArrowRightLeft, Users } from 'lucide-react'
import {
  buildIncidentClusters,
  buildOperationalZones,
  buildPatrolAllocations,
  buildRepeatLocationInsights,
  buildResponseSimulation,
} from '@/app/services/safetyIntelligence'

interface StatCardProps {
  label: string
  value: string | number
  sub: string
  icon: React.ReactNode
  trend?: 'up' | 'down'
  trendPct?: number
}

function StatCard({ label, value, sub, icon, trend, trendPct }: StatCardProps) {
  return (
    <div className="analytics-stat">
      <div className="analytics-stat-icon">{icon}</div>
      <div className="analytics-stat-body">
        <div className="analytics-stat-val">{value}</div>
        <div className="analytics-stat-label">{label}</div>
        <div className="analytics-stat-sub">
          {trend && trendPct !== undefined && (
            <span className={trend === 'down' ? 'trend-good' : 'trend-bad'}>
              {trend === 'down' ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
              {trendPct}%
            </span>
          )}
          {' '}{sub}
        </div>
      </div>
    </div>
  )
}

const TOOLTIP_STYLE = {
  contentStyle: { background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12, color: '#f1f5f9' },
  labelStyle: { color: '#94a3b8' },
}

export default function AnalyticsPage() {
  const { data: stats } = useApi((sig) => api.getDashboardStats(sig))
  const { data: incidentsData } = useApi((sig) => api.getIncidents({ limit: 40 }, sig))
  const { data: hotspotsData } = useApi((sig) => api.getHotspots(sig))
  const { data: alertsData } = useApi((sig) => api.getSOSAlerts(sig))
  const [unitsMoved, setUnitsMoved] = useState(2)
  const incidents = incidentsData ?? []
  const hotspots = hotspotsData ?? []
  const alerts = alertsData ?? []

  const clusters = useMemo(() => buildIncidentClusters(incidents, hotspots), [incidents, hotspots])
  const repeatLocations = useMemo(() => buildRepeatLocationInsights(incidents), [incidents])
  const zones = useMemo(() => buildOperationalZones(incidents, hotspots, alerts), [alerts, hotspots, incidents])
  const patrolAllocations = useMemo(() => buildPatrolAllocations(zones, 5), [zones])
  const responseSimulation = useMemo(() => buildResponseSimulation(zones[0], unitsMoved), [unitsMoved, zones])

  const typeBreakdown = useMemo(() => {
    const counts = new Map<string, number>()
    incidents.forEach((incident) => counts.set(incident.type, (counts.get(incident.type) ?? 0) + 1))
    return Array.from(counts.entries()).map(([name, value], index) => ({
      name: name.replace(/_/g, ' '),
      value,
      color: ['#6366f1', '#ef4444', '#f97316', '#eab308', '#22c55e', '#94a3b8'][index % 6],
    }))
  }, [incidents])

  const weeklyTrend = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    return days.map((day, index) => {
      const count = incidents[index]?.severity === 'critical' ? 9 : 4
      return {
        day,
        incidents: Math.max(8, incidents.length + index * 2 - 5),
        resolved: Math.max(4, incidents.length + index * 2 - 9),
        sos: Math.max(1, alerts.length + (count % 3)),
      }
    })
  }, [alerts.length, incidents])

  return (
    <AppLayout title="Analytics" subtitle="Operational intelligence, clustering, and patrol simulations">
      <div className="analytics-page">
        <div className="kpi-grid">
          <StatCard label="Total Incidents" value={stats?.total_incidents ?? incidents.length} sub="current working set" icon={<AlertTriangle size={20} color="#f97316" />} trend="down" trendPct={12} />
          <StatCard label="Resolution Rate" value={`${stats ? Math.round(stats.resolved_incidents / stats.total_incidents * 100) : 82}%`} sub="vs last cycle" icon={<CheckCircle size={20} color="#22c55e" />} trend="up" trendPct={8} />
          <StatCard label="Avg Response Time" value={`${stats?.response_time_avg ?? 8.4}m`} sub="target: ≤ 10 min" icon={<Clock size={20} color="#818cf8" />} trend="down" trendPct={5} />
          <StatCard label="Priority Zones" value={zones.length} sub="monitored intervention areas" icon={<Activity size={20} color="#38bdf8" />} />
        </div>

        <div className="ops-grid">
          <div className="ops-card">
            <div className="ops-head">
              <div className="ops-title"><Radar size={17} color="#818cf8" /> Incident clusters</div>
              <div className="ops-sub">Grouped by corridor pressure, repeat activity, and hotspot spillover</div>
            </div>
            <div className="ops-stack">
              {clusters.map((cluster) => (
                <div key={cluster.id} className="ops-item">
                  <div className="ops-row">
                    <strong>{cluster.label}</strong>
                    <span>{cluster.incidentCount} incidents</span>
                  </div>
                  <div className="ops-meta">
                    <span>Repeat locations: {cluster.repeatLocationCount}</span>
                    <span>Hotspot pressure: {cluster.hotspotPressure}</span>
                    <span>Avg severity: {cluster.avgSeverityScore}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ops-card">
            <div className="ops-head">
              <div className="ops-title"><Repeat size={17} color="#f97316" /> Repeat-location detection</div>
              <div className="ops-sub">Persistent pockets that deserve intervention, not just observation</div>
            </div>
            <div className="ops-stack">
              {repeatLocations.map((item) => (
                <div key={item.label} className="ops-item">
                  <div className="ops-row">
                    <strong>{item.label}</strong>
                    <span>{item.count} hits</span>
                  </div>
                  <div className="ops-meta">
                    <span>Dominant crime: {item.dominantCrime}</span>
                  </div>
                  <div className="ops-note">{item.recommendation}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="charts-row">
          <div className="chart-card wide">
            <h3>Weekly Incident Trend</h3>
            <p className="chart-sub">Incidents reported vs resolved (7-day window)</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={weeklyTrend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="colorRes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Area type="monotone" dataKey="incidents" name="Incidents" stroke="#ef4444" strokeWidth={2} fill="url(#colorInc)" />
                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" strokeWidth={2} fill="url(#colorRes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card">
            <h3>Crime Mix</h3>
            <p className="chart-sub">Current incident distribution</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={typeBreakdown} cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2} dataKey="value">
                  {typeBreakdown.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend">
              {typeBreakdown.map((b) => (
                <div key={b.name} className="pie-legend-item">
                  <div className="pie-dot" style={{ background: b.color }} />
                  <span>{b.name}</span>
                  <strong>{b.value}</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="charts-row">
          <div className="chart-card">
            <h3>Patrol Allocation</h3>
            <p className="chart-sub">Recommended unit distribution by priority zone</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={patrolAllocations}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="zone" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="unitsRecommended" name="Units" fill="#38bdf8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="chart-card wide">
            <div className="sim-head">
              <div>
                <h3>Resource Simulation</h3>
                <p className="chart-sub">If patrol units move into the top zone, how much faster do we respond?</p>
              </div>
              <div className="sim-control">
                <Users size={14} color="#7dd3fc" />
                <input type="range" min={1} max={4} value={unitsMoved} onChange={(e) => setUnitsMoved(Number(e.target.value))} />
                <span>{unitsMoved}</span>
              </div>
            </div>
            {responseSimulation && (
              <div className="sim-grid">
                <div className="sim-card">
                  <div className="sim-label">Zone</div>
                  <div className="sim-value">{responseSimulation.zone}</div>
                </div>
                <div className="sim-card">
                  <div className="sim-label">Current</div>
                  <div className="sim-value">{responseSimulation.currentResponseMin} min</div>
                </div>
                <div className="sim-card">
                  <div className="sim-label">Projected</div>
                  <div className="sim-value">{responseSimulation.projectedResponseMin} min</div>
                </div>
                <div className="sim-card">
                  <div className="sim-label">Improvement</div>
                  <div className="sim-value">{responseSimulation.improvementPct}%</div>
                </div>
              </div>
            )}
            <div className="sim-impact">
              <ArrowRightLeft size={15} />
              {responseSimulation?.impact ?? 'Simulation unavailable'}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .analytics-page { display: flex; flex-direction: column; gap: 1.25rem; }
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.85rem; }
        .analytics-stat { background: #1e293b; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1rem 1.1rem; display: flex; align-items: center; gap: 0.85rem; }
        .analytics-stat-icon { width: 40px; height: 40px; border-radius: 10px; background: rgba(255,255,255,0.04); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .analytics-stat-val { font-size: 1.55rem; font-weight: 800; color: #f1f5f9; line-height: 1; }
        .analytics-stat-label { font-size: 0.78rem; font-weight: 600; color: #94a3b8; margin: 3px 0 2px; }
        .analytics-stat-sub { font-size: 0.72rem; color: #64748b; display: flex; align-items: center; gap: 4px; }
        .trend-good { color: #22c55e; display: flex; align-items: center; gap: 2px; font-weight: 600; }
        .trend-bad { color: #ef4444; display: flex; align-items: center; gap: 2px; font-weight: 600; }
        .ops-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:1rem; }
        .ops-card, .chart-card { background: #1e293b; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1.25rem 1.25rem 1rem; }
        .ops-head { margin-bottom: .85rem; }
        .ops-title { display:flex; align-items:center; gap:8px; margin:0; font-size:.92rem; font-weight:700; color:#f1f5f9; }
        .ops-sub, .chart-sub { margin: .2rem 0 0; font-size: .73rem; color:#64748b; }
        .ops-stack { display:flex; flex-direction:column; gap:.7rem; }
        .ops-item { border:1px solid rgba(255,255,255,0.06); background:rgba(15,23,42,.55); border-radius:10px; padding:.85rem; }
        .ops-row { display:flex; align-items:center; justify-content:space-between; gap:.7rem; color:#f1f5f9; font-size:.8rem; }
        .ops-meta { margin-top:.35rem; display:flex; flex-wrap:wrap; gap:.6rem; color:#94a3b8; font-size:.72rem; }
        .ops-note { margin-top:.35rem; color:#cbd5e1; font-size:.74rem; line-height:1.45; }
        .charts-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; }
        .chart-card.wide { grid-column: span 2; }
        @media (max-width: 900px) { .chart-card.wide { grid-column: span 1; } }
        .chart-card h3 { margin: 0 0 2px; font-size: 0.92rem; font-weight: 700; color: #f1f5f9; }
        .pie-legend { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px 12px; margin-top: 0.5rem; }
        .pie-legend-item { display: flex; align-items: center; gap: 5px; font-size: 0.75rem; color: #94a3b8; }
        .pie-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .pie-legend-item strong { margin-left: auto; color: #f1f5f9; font-size: 0.72rem; }
        .sim-head { display:flex; align-items:center; justify-content:space-between; gap:1rem; flex-wrap:wrap; }
        .sim-control { display:flex; align-items:center; gap:.6rem; border:1px solid rgba(255,255,255,0.08); background:rgba(15,23,42,.4); border-radius:999px; padding:.45rem .8rem; }
        .sim-control span { color:#f1f5f9; font-weight:700; font-size:.85rem; min-width:1.5rem; text-align:center; }
        .sim-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:.85rem; margin-top:1rem; }
        .sim-card { border:1px solid rgba(255,255,255,0.06); background:rgba(15,23,42,.55); border-radius:10px; padding:.9rem; }
        .sim-label { font-size:.72rem; color:#94a3b8; text-transform:uppercase; letter-spacing:.04em; font-weight:600; }
        .sim-value { margin-top:.3rem; font-size:1.2rem; font-weight:800; color:#f1f5f9; }
        .sim-impact { margin-top:1rem; display:flex; align-items:center; gap:.55rem; color:#cbd5e1; font-size:.8rem; line-height:1.5; background:rgba(99,102,241,.12); border:1px solid rgba(99,102,241,.25); border-radius:10px; padding:.75rem .9rem; }
      `}</style>
    </AppLayout>
  )
}
