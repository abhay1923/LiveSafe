import React, { useMemo } from 'react'
import { useApi } from '@/app/hooks/useApi'
import { api } from '@/app/services/api'
import AppLayout from '@/components/layout/AppLayout'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { TrendingDown, TrendingUp, AlertTriangle, Clock, CheckCircle, Activity } from 'lucide-react'

// ---- Mock chart data ----
const WEEKLY_TREND = [
  { day: 'Mon', incidents: 24, resolved: 19, sos: 2 },
  { day: 'Tue', incidents: 31, resolved: 28, sos: 4 },
  { day: 'Wed', incidents: 18, resolved: 16, sos: 1 },
  { day: 'Thu', incidents: 42, resolved: 35, sos: 6 },
  { day: 'Fri', incidents: 38, resolved: 30, sos: 5 },
  { day: 'Sat', incidents: 55, resolved: 44, sos: 8 },
  { day: 'Sun', incidents: 29, resolved: 22, sos: 3 },
]

const CRIME_BREAKDOWN = [
  { name: 'Theft',      value: 38, color: '#6366f1' },
  { name: 'Robbery',    value: 18, color: '#ef4444' },
  { name: 'Assault',    value: 12, color: '#f97316' },
  { name: 'Harassment', value: 15, color: '#eab308' },
  { name: 'Vandalism',  value: 9,  color: '#22c55e' },
  { name: 'Other',      value: 8,  color: '#94a3b8' },
]

const MONTHLY_TREND = [
  { month: 'Sep', crimes: 312 },
  { month: 'Oct', crimes: 298 },
  { month: 'Nov', crimes: 341 },
  { month: 'Dec', crimes: 287 },
  { month: 'Jan', crimes: 263 },
  { month: 'Feb', crimes: 241 },
  { month: 'Mar', crimes: 218 },
]

function buildHourHeatmap() {
  return Array.from({ length: 24 }, (_, h) => ({
    hour: `${h}:00`,
    crimes: h >= 20 || h <= 4 ? Math.floor(Math.random() * 30) + 20
          : h >= 8 && h <= 18  ? Math.floor(Math.random() * 15) + 5
          : Math.floor(Math.random() * 10) + 3,
  }))
}

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
  // Build once per mount — not at module load — so Math.random() fires at render time
  const HOUR_HEATMAP = useMemo(() => buildHourHeatmap(), [])

  return (
    <AppLayout title="Analytics" subtitle="Crime trends and patrol performance — Delhi NCR">
      <div className="analytics-page">
        {/* KPI row */}
        <div className="kpi-grid">
          <StatCard
            label="Total Incidents" value={stats?.total_incidents ?? 1847}
            sub="this month" icon={<AlertTriangle size={20} color="#f97316" />}
            trend="down" trendPct={12}
          />
          <StatCard
            label="Resolution Rate" value={`${stats ? Math.round(stats.resolved_incidents / stats.total_incidents * 100) : 82}%`}
            sub="vs 74% last month" icon={<CheckCircle size={20} color="#22c55e" />}
            trend="up" trendPct={8}
          />
          <StatCard
            label="Avg Response Time" value={`${stats?.response_time_avg ?? 8.4}m`}
            sub="target: ≤ 10 min" icon={<Clock size={20} color="#818cf8" />}
            trend="down" trendPct={5}
          />
          <StatCard
            label="Active Hotspots" value={stats?.hotspot_count ?? 6}
            sub="monitored zones" icon={<Activity size={20} color="#38bdf8" />}
          />
        </div>

        {/* Charts row 1 */}
        <div className="charts-row">
          {/* Weekly trend area chart */}
          <div className="chart-card wide">
            <h3>Weekly Incident Trend</h3>
            <p className="chart-sub">Incidents reported vs resolved (7-day window)</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={WEEKLY_TREND} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="colorRes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#22c55e" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="day" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#94a3b8' }} />
                <Area type="monotone" dataKey="incidents" name="Incidents" stroke="#ef4444" strokeWidth={2} fill="url(#colorInc)" />
                <Area type="monotone" dataKey="resolved"  name="Resolved"  stroke="#22c55e" strokeWidth={2} fill="url(#colorRes)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Crime type pie */}
          <div className="chart-card">
            <h3>Crime Type Breakdown</h3>
            <p className="chart-sub">Distribution this month</p>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={CRIME_BREAKDOWN}
                  cx="50%" cy="50%"
                  innerRadius={55} outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {CRIME_BREAKDOWN.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8, fontSize: 12 }}
                  formatter={(v: number) => [`${v}%`, '']}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pie-legend">
              {CRIME_BREAKDOWN.map((b) => (
                <div key={b.name} className="pie-legend-item">
                  <div className="pie-dot" style={{ background: b.color }} />
                  <span>{b.name}</span>
                  <strong>{b.value}%</strong>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Charts row 2 */}
        <div className="charts-row">
          {/* Monthly bar */}
          <div className="chart-card">
            <h3>Monthly Crime Count</h3>
            <p className="chart-sub">7-month historical view</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={MONTHLY_TREND} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="crimes" name="Crimes" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Hour-of-day */}
          <div className="chart-card wide">
            <h3>Crime Frequency by Hour of Day</h3>
            <p className="chart-sub">Peak hours: 8pm–4am</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={HOUR_HEATMAP} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: '#64748b', fontSize: 9 }}
                  axisLine={false} tickLine={false}
                  interval={2}
                />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar
                  dataKey="crimes"
                  name="Incidents"
                  radius={[2, 2, 0, 0]}
                >
                  {HOUR_HEATMAP.map((entry, i) => (
                    <Cell
                      key={i}
                      fill={entry.crimes > 25 ? '#ef4444' : entry.crimes > 15 ? '#f97316' : '#6366f1'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <style>{`
        .analytics-page { display: flex; flex-direction: column; gap: 1.25rem; }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 0.85rem;
        }
        .analytics-stat {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 1rem 1.1rem;
          display: flex;
          align-items: center;
          gap: 0.85rem;
        }
        .analytics-stat-icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(255,255,255,0.04);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .analytics-stat-val { font-size: 1.55rem; font-weight: 800; color: #f1f5f9; line-height: 1; }
        .analytics-stat-label { font-size: 0.78rem; font-weight: 600; color: #94a3b8; margin: 3px 0 2px; }
        .analytics-stat-sub { font-size: 0.72rem; color: #64748b; display: flex; align-items: center; gap: 4px; }
        .trend-good { color: #22c55e; display: flex; align-items: center; gap: 2px; font-weight: 600; }
        .trend-bad  { color: #ef4444; display: flex; align-items: center; gap: 2px; font-weight: 600; }
        .charts-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 1rem;
        }
        .chart-card {
          background: #1e293b;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 12px;
          padding: 1.25rem 1.25rem 1rem;
        }
        .chart-card.wide { grid-column: span 2; }
        @media (max-width: 900px) { .chart-card.wide { grid-column: span 1; } }
        .chart-card h3 { margin: 0 0 2px; font-size: 0.92rem; font-weight: 700; color: #f1f5f9; }
        .chart-sub { margin: 0 0 1rem; font-size: 0.73rem; color: #64748b; }
        .pie-legend {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 4px 12px;
          margin-top: 0.5rem;
        }
        .pie-legend-item {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 0.75rem;
          color: #94a3b8;
        }
        .pie-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .pie-legend-item strong { margin-left: auto; color: #f1f5f9; font-size: 0.72rem; }
      `}</style>
    </AppLayout>
  )
}
