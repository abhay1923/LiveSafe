import { useEffect, useMemo, useState } from 'react'
import { api } from '@/app/services/api'
import type { Incident } from '@/types'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from 'recharts'
import {
  FileText, Filter, Download, Loader2, AlertCircle, RefreshCw,
  TrendingUp, ShieldAlert, MapPin, Clock,
} from 'lucide-react'

const TYPE_OPTIONS = [
  '', 'theft', 'robbery', 'assault', 'harassment', 'vandalism', 'burglary',
  'fraud', 'cybercrime', 'drug_offense', 'kidnapping', 'extortion', 'other',
]
const SEVERITY_OPTIONS = ['', 'low', 'medium', 'high', 'critical']
const STATUS_OPTIONS   = ['', 'reported', 'verified', 'resolved', 'dismissed']

const SEVERITY_COLORS: Record<string, string> = {
  low: '#22c55e', medium: '#eab308', high: '#f97316', critical: '#ef4444',
}
const STATUS_COLORS: Record<string, string> = {
  reported: '#3b82f6', verified: '#a855f7', resolved: '#22c55e', dismissed: '#64748b',
}

export default function Reports() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [stats, setStats] = useState<Awaited<ReturnType<typeof api.getIncidentStats>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({ type: '', severity: '', status: '', from: '', to: '' })

  const load = async (signal?: AbortSignal) => {
    try {
      setError('')
      setLoading(true)
      const f = {
        type: filters.type || undefined,
        severity: filters.severity || undefined,
        status: filters.status || undefined,
        from: filters.from ? new Date(filters.from).toISOString() : undefined,
        to:   filters.to   ? new Date(filters.to).toISOString()   : undefined,
        limit: 200,
      }
      const [list, st] = await Promise.all([
        api.getIncidents(f, signal),
        api.getIncidentStats(signal),
      ])
      setIncidents(list)
      setStats(st)
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Failed to load reports')
    } finally { setLoading(false) }
  }

  useEffect(() => {
    const ac = new AbortController()
    load(ac.signal)
    return () => ac.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.type, filters.severity, filters.status, filters.from, filters.to])

  const exportCSV = () => {
    const header = ['id', 'type', 'severity', 'status', 'description', 'latitude', 'longitude', 'created_at']
    const rows = incidents.map(i => [
      i.id, i.type, i.severity, i.status,
      JSON.stringify(i.description), i.latitude, i.longitude, i.created_at,
    ].join(','))
    const blob = new Blob([header.join(',') + '\n' + rows.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `livesafe-incidents-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 }
    incidents.forEach(i => { counts[i.severity] = (counts[i.severity] ?? 0) + 1 })
    return Object.entries(counts).map(([severity, count]) => ({ severity, count }))
  }, [incidents])

  const totalShown = incidents.length
  const criticalCount = incidents.filter(i => i.severity === 'critical').length
  const resolvedCount = incidents.filter(i => i.status === 'resolved').length
  const resolveRate = totalShown ? Math.round((resolvedCount / totalShown) * 100) : 0

  return (
    <div className="rp-page">
      <div className="rp-header">
        <div className="rp-title">
          <FileText size={22} color="#818cf8" />
          <div>
            <h2>Crime Incident Reports</h2>
            <p>Live data from the field — filter, analyze, and export</p>
          </div>
        </div>
        <div className="rp-header-actions">
          <button className="rp-btn ghost" onClick={() => load()} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'spin' : ''}/> Refresh
          </button>
          <button className="rp-btn primary" onClick={exportCSV} disabled={!incidents.length}>
            <Download size={14}/> Export CSV
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="rp-stats">
        <StatCard icon={<FileText size={18}/>} label="Total in DB" value={stats?.total ?? '—'} color="#818cf8" />
        <StatCard icon={<TrendingUp size={18}/>} label="Showing" value={totalShown} color="#22c55e" />
        <StatCard icon={<ShieldAlert size={18}/>} label="Critical" value={criticalCount} color="#ef4444" />
        <StatCard icon={<Clock size={18}/>} label="Resolve rate" value={`${resolveRate}%`} color="#fbbf24" />
      </div>

      {/* Filters */}
      <div className="rp-filters">
        <div className="rp-filter-head"><Filter size={14}/> Filters</div>
        <div className="rp-filter-row">
          <Select label="Type" value={filters.type} options={TYPE_OPTIONS}
            onChange={v => setFilters(s => ({ ...s, type: v }))} />
          <Select label="Severity" value={filters.severity} options={SEVERITY_OPTIONS}
            onChange={v => setFilters(s => ({ ...s, severity: v }))} />
          <Select label="Status" value={filters.status} options={STATUS_OPTIONS}
            onChange={v => setFilters(s => ({ ...s, status: v }))} />
          <DateInput label="From" value={filters.from} onChange={v => setFilters(s => ({ ...s, from: v }))} />
          <DateInput label="To" value={filters.to} onChange={v => setFilters(s => ({ ...s, to: v }))} />
          <button className="rp-clear" onClick={() => setFilters({ type:'', severity:'', status:'', from:'', to:'' })}>
            Clear
          </button>
        </div>
      </div>

      {error && <div className="rp-error"><AlertCircle size={16}/> {error}</div>}

      {/* Charts */}
      <div className="rp-charts">
        <div className="rp-chart-card">
          <h3>By Crime Type</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <BarChart data={stats?.by_type ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="type" stroke="#94a3b8" tick={{ fontSize: 11 }} angle={-25} textAnchor="end" height={60}/>
                <YAxis stroke="#94a3b8" allowDecimals={false}/>
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8 }}/>
                <Bar dataKey="count" fill="#818cf8" radius={[6,6,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rp-chart-card">
          <h3>Severity Mix (current view)</h3>
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={severityCounts} dataKey="count" nameKey="severity" cx="50%" cy="50%"
                  outerRadius={80} label={(e: { severity: string; count: number }) => `${e.severity}: ${e.count}`}>
                  {severityCounts.map(s => (
                    <Cell key={s.severity} fill={SEVERITY_COLORS[s.severity] ?? '#64748b'}/>
                  ))}
                </Pie>
                <Legend/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rp-chart-card wide">
          <h3>Last 7 Days</h3>
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={stats?.timeline_7d ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="day" stroke="#94a3b8" tick={{ fontSize: 11 }}/>
                <YAxis stroke="#94a3b8" allowDecimals={false}/>
                <Tooltip contentStyle={{ background:'#1e293b', border:'1px solid #334155', borderRadius:8 }}/>
                <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={2} dot={{ r:4 }}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rp-table-card">
        <h3>Incident Log ({totalShown})</h3>
        {loading ? (
          <div className="rp-empty"><Loader2 size={24} className="spin"/> Loading…</div>
        ) : incidents.length === 0 ? (
          <div className="rp-empty">
            No incidents match these filters. Try clearing filters or check that incidents have been reported in the system.
          </div>
        ) : (
          <div className="rp-table-wrap">
            <table className="rp-table">
              <thead>
                <tr>
                  <th>Time</th><th>Type</th><th>Severity</th><th>Status</th>
                  <th>Description</th><th>Location</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map(i => (
                  <tr key={i.id}>
                    <td className="muted">{new Date(i.created_at).toLocaleString()}</td>
                    <td>{i.type}</td>
                    <td>
                      <span className="rp-pill" style={{
                        background: (SEVERITY_COLORS[i.severity] ?? '#64748b') + '22',
                        color: SEVERITY_COLORS[i.severity] ?? '#64748b',
                      }}>{i.severity}</span>
                    </td>
                    <td>
                      <span className="rp-pill" style={{
                        background: (STATUS_COLORS[i.status] ?? '#64748b') + '22',
                        color: STATUS_COLORS[i.status] ?? '#64748b',
                      }}>{i.status}</span>
                    </td>
                    <td className="rp-desc">{i.description}</td>
                    <td className="muted">
                      <MapPin size={12} style={{ display:'inline', marginRight:4 }}/>
                      {i.latitude.toFixed(3)}, {i.longitude.toFixed(3)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .rp-page{padding:1.25rem;display:flex;flex-direction:column;gap:1.1rem;color:#e2e8f0}
        .rp-header{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}
        .rp-title{display:flex;gap:.7rem;align-items:center}
        .rp-title h2{margin:0;font-size:1.3rem;font-weight:700;color:#f1f5f9}
        .rp-title p{margin:0;font-size:.78rem;color:#64748b}
        .rp-header-actions{display:flex;gap:.5rem}
        .rp-btn{display:flex;align-items:center;gap:6px;padding:.5rem .85rem;border-radius:8px;font-size:.82rem;font-weight:600;cursor:pointer;border:1px solid transparent;transition:all .15s}
        .rp-btn.ghost{background:rgba(15,23,42,.6);border-color:#334155;color:#cbd5e1}
        .rp-btn.ghost:hover{border-color:#6366f1;color:#a5b4fc}
        .rp-btn.primary{background:#6366f1;color:white}
        .rp-btn.primary:hover{background:#4f46e5}
        .rp-btn:disabled{opacity:.5;cursor:wait}
        .spin{animation:spin .8s linear infinite}
        @keyframes spin{to{transform:rotate(360deg)}}
        .rp-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem}
        .rp-filters{background:rgba(30,41,59,.6);border:1px solid #334155;border-radius:12px;padding:.85rem 1rem;display:flex;flex-direction:column;gap:.6rem}
        .rp-filter-head{display:flex;align-items:center;gap:6px;font-size:.78rem;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em}
        .rp-filter-row{display:flex;flex-wrap:wrap;gap:.5rem;align-items:flex-end}
        .rp-clear{background:rgba(15,23,42,.6);border:1px solid #334155;border-radius:8px;padding:.45rem .75rem;color:#94a3b8;cursor:pointer;font-size:.78rem;font-weight:600;height:34px}
        .rp-clear:hover{border-color:#ef4444;color:#f87171}
        .rp-error{display:flex;align-items:center;gap:8px;background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.4);color:#f87171;padding:.6rem .85rem;border-radius:9px;font-size:.85rem}
        .rp-charts{display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:.85rem}
        .rp-chart-card{background:rgba(30,41,59,.6);border:1px solid #334155;border-radius:12px;padding:1rem}
        .rp-chart-card.wide{grid-column:1/-1}
        .rp-chart-card h3{margin:0 0 .75rem;font-size:.92rem;color:#cbd5e1;font-weight:700}
        .rp-table-card{background:rgba(30,41,59,.6);border:1px solid #334155;border-radius:12px;padding:1rem}
        .rp-table-card h3{margin:0 0 .75rem;font-size:.92rem;color:#cbd5e1;font-weight:700}
        .rp-empty{padding:2rem;text-align:center;color:#64748b;font-size:.9rem;display:flex;align-items:center;justify-content:center;gap:8px}
        .rp-table-wrap{overflow-x:auto;max-height:420px}
        .rp-table{width:100%;border-collapse:collapse;font-size:.82rem}
        .rp-table th{text-align:left;padding:.55rem .65rem;background:rgba(15,23,42,.6);color:#94a3b8;font-weight:600;font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;position:sticky;top:0}
        .rp-table td{padding:.55rem .65rem;border-bottom:1px solid #1e293b;vertical-align:top}
        .rp-table tr:hover td{background:rgba(99,102,241,.06)}
        .rp-table .muted{color:#64748b;white-space:nowrap}
        .rp-desc{max-width:340px;color:#cbd5e1}
        .rp-pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
      `}</style>
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: React.ReactNode; color: string }) {
  return (
    <div style={{
      background: 'rgba(30,41,59,.6)', border: '1px solid #334155', borderLeft: `3px solid ${color}`,
      borderRadius: 12, padding: '.85rem 1rem', display: 'flex', alignItems: 'center', gap: '.75rem',
    }}>
      <div style={{ color, background: color + '22', padding: 8, borderRadius: 8, display: 'flex' }}>{icon}</div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '.05em', fontWeight: 600 }}>{label}</span>
        <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#f1f5f9' }}>{value}</span>
      </div>
    </div>
  )
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <label style={{ fontSize:'.7rem', color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</label>
      <select value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        style={{ background:'rgba(15,23,42,.6)', border:'1px solid #334155', borderRadius:8, padding:'.4rem .6rem', color:'#e2e8f0', fontSize:'.82rem', height:34, minWidth:120 }}>
        {options.map(o => <option key={o} value={o}>{o || `Any ${label.toLowerCase()}`}</option>)}
      </select>
    </div>
  )
}

function DateInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
      <label style={{ fontSize:'.7rem', color:'#94a3b8', fontWeight:600, textTransform:'uppercase', letterSpacing:'.04em' }}>{label}</label>
      <input type="date" value={value} onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
        style={{ background:'rgba(15,23,42,.6)', border:'1px solid #334155', borderRadius:8, padding:'.4rem .6rem', color:'#e2e8f0', fontSize:'.82rem', height:34 }}/>
    </div>
  )
}
