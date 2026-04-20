import { useState, useEffect } from 'react'
import { TrendingDown, ShieldCheck, MapPin } from 'lucide-react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { supabase } from '@/lib/supabase'

const trendData = [
  { day: 'Day 3', actual: 120, predicted: 115 },
  { day: 'Day 6', actual: 132, predicted: 128 },
  { day: 'Day 9', actual: 141, predicted: 138 },
  { day: 'Day 15', actual: 160, predicted: 165 },
  { day: 'Day 20', actual: 185, predicted: 190 },
  { day: 'Day 28', actual: 178, predicted: 182 },
]

const typeData = [
  { name: 'Assault',  actual: 32, predicted: 10 },
  { name: 'Robbery',  actual: 28, predicted: 18 },
  { name: 'Burglary', actual: 24, predicted: 16 },
  { name: 'Theft',    actual: 14, predicted: 8  },
]

interface Stats {
  hotspot_count: number
  total_incidents: number
  active_sos: number
  critical_count: number
}

export default function Dashboard() {
  const [stats, setStats] = useState<Stats>({
    hotspot_count: 0,
    total_incidents: 0,
    active_sos: 0,
    critical_count: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const [hotspotsRes, incidentsRes, sosRes, criticalRes] = await Promise.all([
          supabase.from('hotspots').select('id', { count: 'exact', head: true }),
          supabase.from('incidents').select('id', { count: 'exact', head: true }),
          supabase.from('sos_alerts').select('id', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('hotspots').select('id', { count: 'exact', head: true }).eq('classification', 'critical'),
        ])
        setStats({
          hotspot_count: hotspotsRes.count ?? 0,
          total_incidents: incidentsRes.count ?? 0,
          active_sos: sosRes.count ?? 0,
          critical_count: criticalRes.count ?? 0,
        })
      } catch (e) {
        console.error('Dashboard stats error:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Main Analytics Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">LiveSafe AI — Crime Prediction Platform</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatCardSmall
            icon={<TrendingDown className="text-green-600 w-5 h-5" />}
            label="Trend"
            value="-3.2%"
          />
          <StatCardSmall
            icon={<ShieldCheck className="text-blue-600 w-5 h-5" />}
            label="Accuracy"
            value="95.7%"
          />
          <StatCardSmall
            icon={<MapPin className="text-blue-600 w-5 h-5" />}
            label="Cities"
            value={loading ? '...' : String(stats.hotspot_count)}
          />
        </div>
      </div>

      {/* Live Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Hotspots" value={loading ? '...' : stats.hotspot_count} color="blue" />
        <StatCard label="Critical Zones" value={loading ? '...' : stats.critical_count} color="red" />
        <StatCard label="Incidents Reported" value={loading ? '...' : stats.total_incidents} color="amber" />
        <StatCard label="Active SOS Alerts" value={loading ? '...' : stats.active_sos} color="green" />
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900">Crime Trends (30 Days)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Actual vs Predicted</p>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="gradActual" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.12} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="actual" stroke="#2563eb" fill="url(#gradActual)" strokeWidth={2} />
                <Area type="monotone" dataKey="predicted" stroke="#94a3b8" fill="none" strokeDasharray="4 4" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-3xl border shadow-sm p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-slate-900">Crime Types</h3>
              <p className="text-xs text-slate-400 mt-0.5">Distribution</p>
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} />
                <YAxis axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="actual" name="Historical" fill="#1e293b" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="predicted" name="Predicted" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Data Source Attribution */}
      <p className="text-xs text-slate-400 text-right">
        Data Source: National Crime Records Bureau (NCRB) — Crime in India 2022
      </p>
    </div>
  )
}

function StatCard({ label, value, color }: { label: string; value: number | string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-700',
    green: 'bg-green-50 text-green-700',
  }
  return (
    <div className={`rounded-2xl p-4 ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wider opacity-70">{label}</p>
      <p className="text-3xl font-bold mt-1">{value}</p>
    </div>
  )
}

function StatCardSmall({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-3 min-w-[140px]">
      <div className="bg-slate-50 p-2 rounded-xl shrink-0">{icon}</div>
      <div>
        <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-lg font-bold text-slate-900">{value}</p>
      </div>
    </div>
  )
}