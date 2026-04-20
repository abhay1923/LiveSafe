import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import { MapContainer, TileLayer, CircleMarker, Popup } from 'react-leaflet'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})
import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown, Calendar, Info, Search, Bell, Menu, Shield, LayoutDashboard, Map as MapIcon, Zap, BarChart3, Settings, LogOut } from 'lucide-react'
import { BarChart, Bar, LineChart, Line, ResponsiveContainer } from 'recharts'
import { motion, AnimatePresence } from 'motion/react'
import { useApi } from '@/app/hooks/useApi'
import { api } from '@/app/services/api'
import type { Hotspot, RiskClassification } from '@/types'
import { cn } from '@/lib/utils'
import { RISK_COLORS, RISK_BG } from '@/app/services/hotspots_v5'

type CrimeFilter = 'Theft' | 'Burglary' | 'Assault' | 'Robbery' | 'Kidnapping' | 'Cybercrime'

const CRIME_FILTERS: CrimeFilter[] = ['Theft', 'Burglary', 'Assault', 'Robbery', 'Kidnapping', 'Cybercrime']

const demographicData = [
  { name: '11', value: 5 }, { name: '03', value: 12 }, { name: '09', value: 8 },
  { name: '10', value: 15 }, { name: '15', value: 7 }, { name: '18', value: 10 },
]

const historicalData = [
  { v: 400 }, { v: 300 }, { v: 600 }, { v: 800 }, { v: 500 },
  { v: 700 }, { v: 900 }, { v: 1100 }, { v: 800 }, { v: 950 }, { v: 700 }, { v: 850 },
]

// Heatmap dots (static for demo)
const heatCells = Array.from({ length: 48 }, (_, i) => ({
  opacity: Math.min(0.9, 0.1 + (i % 12) * 0.07),
}))

export default function HotspotMapNew() {
  const [riskFilter, setRiskFilter] = useState<'all' | RiskClassification>('all')
  const [selectedState, setSelectedState] = useState('all')
  const [checkedCrimes, setCheckedCrimes] = useState<Set<CrimeFilter>>(
    new Set(['Theft', 'Burglary', 'Assault', 'Robbery'])
  )
  const [selectedCity, setSelectedCity] = useState<Hotspot | null>(null)

  const { data: rawHotspots, isLoading, error, refetch } = useApi((sig) => api.getHotspots(sig))
  const hotspots: Hotspot[] = rawHotspots || []

  const filteredHotspots = hotspots.filter(h =>
    (riskFilter === 'all' || h.classification === riskFilter) &&
    (selectedState === 'all' || h.state.includes(selectedState))
  )

  const states = ['all', ...Array.from(new Set(hotspots.map(h => h.state.split(', ')[1]))).sort() as string[]]

  const toggleCrime = (c: CrimeFilter) => {
    setCheckedCrimes(prev => {
      const next = new Set(prev)
      next.has(c) ? next.delete(c) : next.add(c)
      return next
    })
  }

  // Map positions — compute grid layout for India bounding box
  const getCityPosition = (hotspot: Hotspot) => {
    // India: lat 8–37, lon 68–97 → normalize to 0-100%
    const x = ((hotspot.longitude - 68) / 29) * 75 + 10
    const y = ((37 - hotspot.latitude) / 29) * 75 + 8
    return { x: `${x}%`, y: `${y}%` }
  }

  if (isLoading) return <div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" /></div>
  if (error) return <div className="p-8 text-center text-red-600">Error loading hotspots. <button onClick={refetch} className="underline">Retry</button></div>

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 bg-slate-50">
      {/* Sidebar controls */}
      <div className="w-full lg:w-80 shrink-0 space-y-4 p-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
          {/* Header + area selector */}
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-slate-900">Hotspot Analysis</h2>
            <div className="relative">
              <select
                value={selectedState}
                onChange={e => setSelectedState(e.target.value as string)}
                className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 pr-7 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 max-w-[130px]"
              >
                <option value="all">All States</option>
                {states.slice(1).map((s, i) => <option key={i} value={s as string}>{s as string}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Risk filter */}
          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Risk Level</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['all' as const, 'critical', 'high', 'medium', 'low'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRiskFilter(r === riskFilter ? 'all' as const : r)}
                  className={cn(
                    'py-1.5 px-2 rounded-lg text-[11px] font-bold border capitalize transition-all',
                    riskFilter === r
                      ? r === 'all'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'text-white border-transparent shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300 hover:shadow-sm'
                  )}
                  style={riskFilter === r && r !== 'all' ? { backgroundColor: RISK_COLORS[r], borderColor: RISK_COLORS[r] } : {}}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Stats */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-4 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-2xl font-black text-blue-700">{filteredHotspots.length}</p>
              <p className="text-xs text-slate-500 mt-1">Hotspots Shown</p>
            </div>
            <div>
              <p className="text-2xl font-black text-indigo-700">{hotspots.length}</p>
              <p className="text-xs text-slate-500 mt-1">Total Cities</p>
            </div>
          </div>

          <button onClick={refetch} className="w-full bg-blue-600 text-white py-2 px-4 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">
            Refresh Data
          </button>
        </div>
      </div>

      {/* Map Area */}
      <div className="flex-1 rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative min-h-[400px]" style={{ zIndex: 1 }}>
        <MapContainer
          center={[22.5, 82.0]}
          zoom={5}
          style={{ height: '100%', width: '100%', minHeight: '400px' }}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filteredHotspots.map((hotspot) => (
            <CircleMarker
              key={hotspot.id}
              center={[hotspot.latitude, hotspot.longitude]}
              radius={hotspot.classification === 'critical' ? 16 : hotspot.classification === 'high' ? 12 : 8}
              fillColor={RISK_COLORS[hotspot.classification]}
              color={RISK_COLORS[hotspot.classification]}
              weight={2}
              opacity={0.9}
              fillOpacity={0.6}
              eventHandlers={{ click: () => setSelectedCity(hotspot) }}
            >
              <Popup>
  <div style={{ minWidth: 210, fontFamily: 'sans-serif' }}>
    <div style={{ 
      borderLeft: `4px solid ${RISK_COLORS[hotspot.classification]}`,
      paddingLeft: 8,
      marginBottom: 8
    }}>
      <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: '#a3319b' }}>
        {hotspot.state}
      </p>
      <p style={{ fontSize: 11, margin: '2px 0 0', color: RISK_COLORS[hotspot.classification], fontWeight: 600 }}>
        {hotspot.classification.toUpperCase()} RISK — {hotspot.risk_score}/100
      </p>
    </div>
    <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
      <tr>
        <td style={{ color: '#8ca0c2', padding: '2px 0' }}>IPC Arrests (2022)</td>
        <td style={{ color: '#8ca0c2', fontWeight: 600, textAlign: 'right' }}>
          {hotspot.crime_count.toLocaleString('en-IN')}
        </td>
      </tr>
      <tr>
        <td style={{ color: '#d2c4c4', padding: '2px 0' }}>Trend</td>
        <td style={{ color: '#8ca0c2', fontWeight: 600, textAlign: 'right' }}>
          {hotspot.trend === 'rising' ? '↑ Rising' : hotspot.trend === 'falling' ? '↓ Falling' : '→ Stable'}
        </td>
      </tr>
      <tr>
        <td style={{ color: '#d2c4c4', padding: '2px 0' }}>Confidence</td>
        <td style={{ color: '#8ca0c2', fontWeight: 600, textAlign: 'right' }}>
          {Math.round((hotspot.model_confidence ?? 0) * 100)}%
        </td>
      </tr>
      <tr>
        <td colSpan={2} style={{ color: '#d2c4c4', padding: '4px 0 2px', fontSize: 11 }}>
          <strong>Crimes:</strong> {hotspot.predicted_crimes.map(c => c.replace('_', ' ')).join(', ')}
        </td>
      </tr>
    </table>
    {hotspot.primary_warning && (
      <p style={{ fontSize: 15, margin: '6px 0 4px', color: '#c53030', fontStyle: 'italic', borderTop: '1px solid #eee', paddingTop: 6 }}>
        ⚠ {hotspot.primary_warning}
      </p>
    )}
    <p style={{ fontSize: 10, margin: '6px 0 0', color: '#999', borderTop: '1px solid #eee', paddingTop: 4 }}>
      Source: NCRB Crime in India 2022
    </p>
  </div>
</Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

        {/* Legend */}
        <div className="absolute bottom-6 right-6 bg-white/95 backdrop-blur-md p-4 rounded-2xl shadow-xl border border-slate-200 z-20 space-y-2">
          {(['critical', 'high', 'medium', 'low'] as RiskClassification[]).map(level => (
            <div key={level} className="flex items-center gap-2 text-xs font-semibold capitalize">
              <div className={`w-3 h-3 rounded-full`} style={{ backgroundColor: RISK_COLORS[level] }} />
              <span className="text-slate-700">{level}</span>
            </div>
          ))}
        </div>

        {/* Selected hotspot popup */}
        <AnimatePresence>
          {selectedCity && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute bottom-6 left-6 right-6 lg:right-auto lg:w-96 bg-white/98 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200 p-6 z-30 max-h-80 overflow-y-auto"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn('px-3 py-1 rounded-full text-xs font-bold border capitalize', RISK_BG[selectedCity.classification])}>
                      {selectedCity.classification}
                    </span>
                    <span className="text-xs text-slate-500">{selectedCity.state.split(', ')[1]}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedCity.state.split(', ')[0]}</h3>
                </div>
                <button onClick={() => setSelectedCity(null)} className="text-slate-400 hover:text-slate-600 text-xl leading-none p-1 -m-1 rounded-lg hover:bg-slate-100 transition-colors">×</button>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-4 p-3 bg-slate-50 rounded-2xl">
                <div className="text-center">
                  <p className="text-2xl font-black text-slate-900">{selectedCity.risk_score.toFixed(1)}</p>
                  <p className="text-xs text-slate-500">Risk Score</p>
                </div>
                <div className="text-center">
                  <p className="text-xl font-bold text-slate-900">{(selectedCity.model_confidence || 0) * 100}%</p>
                  <p className="text-xs text-slate-500">Confidence</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{selectedCity.crime_count}</p>
                  <p className="text-xs text-slate-500">Incidents</p>
                </div>
              </div>

              {selectedCity.primary_warning && (
                <p className="text-sm text-slate-700 leading-relaxed mb-3">{selectedCity.primary_warning}</p>
              )}

              <div className="flex flex-wrap gap-1.5">
                {selectedCity.predicted_crimes.slice(0, 4).map(crime => (
                  <span key={crime} className="px-2 py-0.5 bg-blue-100 text-blue-800 text-xs font-bold rounded-full border border-blue-200">
                    {crime.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  )
}
