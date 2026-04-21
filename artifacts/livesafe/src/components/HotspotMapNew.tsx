import 'leaflet/dist/leaflet.css'
import React, { useState, useCallback, useEffect } from 'react'
import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import { MapContainer, TileLayer, CircleMarker, Popup, Marker, useMap } from 'react-leaflet'
import { ChevronDown, Loader2, CheckCircle2, XCircle, MapPin } from 'lucide-react'
import { motion, AnimatePresence } from 'motion/react'
import { useApi } from '@/app/hooks/useApi'
import { useAuth } from '@/app/hooks/useAuth'
import { api } from '@/app/services/api'
import type { Hotspot, RiskClassification, SOSAlert } from '@/types'
import { cn } from '@/lib/utils'
import { RISK_COLORS, RISK_BG } from '@/app/services/hotspots_v5'

delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
})

type SOSPhase = 'idle' | 'locating' | 'sending' | 'success' | 'error'

const sosUserIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:18px;height:18px;background:#ef4444;border:3px solid white;border-radius:50%;box-shadow:0 0 0 4px rgba(239,68,68,0.35),0 2px 6px rgba(0,0,0,0.4)"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
})

function FlyTo({ target }: { target: { lat: number; lon: number } | null }) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lon], 13, { duration: 1.4 })
  }, [target, map])
  return null
}

export default function HotspotMapNew() {
  const { user } = useAuth()
  const isCitizen = user?.role === 'citizen'

  const [riskFilter, setRiskFilter] = useState<'all' | RiskClassification>('all')
  const [selectedState, setSelectedState] = useState('all')
  const [selectedCity, setSelectedCity] = useState<Hotspot | null>(null)

  const [sosPhase, setSOSPhase] = useState<SOSPhase>('idle')
  const [sosError, setSOSError] = useState('')
  const [sosResult, setSOSResult] = useState<SOSAlert | null>(null)
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null)
  const [watchId, setWatchId] = useState<number | null>(null)
  const [shareLive, setShareLive] = useState(true)

  const { data: rawHotspots, isLoading, error, refetch } = useApi((sig) => api.getHotspots(sig))
  const hotspots: Hotspot[] = rawHotspots || []

  const filteredHotspots = hotspots.filter(h =>
    (riskFilter === 'all' || h.classification === riskFilter) &&
    (selectedState === 'all' || h.state.includes(selectedState))
  )

  const states = ['all', ...Array.from(new Set(hotspots.map(h => h.state.split(', ')[1]))).sort() as string[]]

  const handleSOS = useCallback(async () => {
    if (sosPhase !== 'idle') return
    setSOSError('')
    setSOSResult(null)
    setSOSPhase('locating')

    const send = async (lat: number, lon: number) => {
      setUserLocation({ lat, lon })
      setSOSPhase('sending')
      try {
        const alert = await api.triggerSOS({
          latitude: lat,
          longitude: lon,
          user_id: user?.id ?? 'anonymous',
          user_name: user?.name,
        })
        setSOSResult(alert)
        setSOSPhase('success')

        // Start live location sharing if enabled
        if (shareLive && navigator.geolocation) {
          const id = navigator.geolocation.watchPosition(
            (pos) => {
              const newLat = pos.coords.latitude
              const newLon = pos.coords.longitude
              setUserLocation({ lat: newLat, lon: newLon })
              api.updateSOSLocation(alert.id, { latitude: newLat, longitude: newLon }).catch(() => {})
            },
            () => {},
            { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
          )
          setWatchId(id)
        }
      } catch {
        setSOSError('Could not send SOS. Please call 112 immediately.')
        setSOSPhase('error')
      }
    }

    if (!navigator.geolocation) {
      setSOSError('Geolocation not supported. Please call 112.')
      setSOSPhase('error')
      return
    }

    navigator.geolocation.getCurrentPosition(
      pos => send(pos.coords.latitude, pos.coords.longitude),
      () => send(28.6139, 77.2090),
      { timeout: 8000, maximumAge: 30000 }
    )
  }, [sosPhase, user, shareLive])

  const resetSOS = () => {
    setSOSPhase('idle')
    setSOSError('')
    setSOSResult(null)
    setUserLocation(null)
    if (watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
  }

  // Cleanup watch on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [watchId])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="p-8 text-center text-red-600">
        Error loading hotspots.{' '}
        <button onClick={refetch} className="underline">Retry</button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 bg-slate-50">
      {/* Sidebar */}
      <div className="w-full lg:w-80 shrink-0 space-y-4 p-4">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-xl text-slate-900">Hotspot Analysis</h2>
            <div className="relative">
              <select
                value={selectedState}
                onChange={e => setSelectedState(e.target.value)}
                className="appearance-none bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 pr-7 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-500 max-w-[130px]"
              >
                <option value="all">All States</option>
                {states.slice(1).map((s, i) => <option key={i} value={s}>{s}</option>)}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Risk Level</p>
            <div className="grid grid-cols-3 gap-1.5">
              {(['all', 'critical', 'high', 'medium', 'low'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRiskFilter(r === riskFilter ? 'all' : r)}
                  className={cn(
                    'py-1.5 px-2 rounded-lg text-[11px] font-bold border capitalize transition-all',
                    riskFilter === r
                      ? r === 'all'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'text-white border-transparent shadow-sm'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-blue-300'
                  )}
                  style={riskFilter === r && r !== 'all' ? { backgroundColor: RISK_COLORS[r], borderColor: RISK_COLORS[r] } : {}}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

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

          {isCitizen && (
            <div className="bg-red-50 border border-red-100 rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-red-600 uppercase tracking-wider">Emergency SOS</p>
              <p className="text-xs text-red-500 leading-relaxed">
                Tap the SOS button on the map to instantly alert police with your GPS location.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Map — position:relative so overlays anchor to it */}
      <div
        className="flex-1 rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative min-h-[400px]"
        style={{ zIndex: 1 }}
      >
        <MapContainer
          center={[22.5, 82.0]}
          zoom={5}
          style={{ height: '100%', width: '100%', minHeight: '400px' }}
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {filteredHotspots.map(hotspot => (
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
                  <div style={{ borderLeft: `4px solid ${RISK_COLORS[hotspot.classification]}`, paddingLeft: 8, marginBottom: 8 }}>
                    <p style={{ fontWeight: 700, fontSize: 14, margin: 0, color: '#1e293b' }}>{hotspot.state}</p>
                    <p style={{ fontSize: 11, margin: '2px 0 0', color: RISK_COLORS[hotspot.classification], fontWeight: 600 }}>
                      {hotspot.classification.toUpperCase()} RISK — {hotspot.risk_score}/100
                    </p>
                  </div>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <tbody>
                      <tr>
                        <td style={{ color: '#64748b', padding: '2px 0' }}>IPC Arrests (2022)</td>
                        <td style={{ fontWeight: 600, textAlign: 'right' }}>{hotspot.crime_count.toLocaleString('en-IN')}</td>
                      </tr>
                      <tr>
                        <td style={{ color: '#64748b', padding: '2px 0' }}>Trend</td>
                        <td style={{ fontWeight: 600, textAlign: 'right' }}>
                          {hotspot.trend === 'rising' ? '↑ Rising' : hotspot.trend === 'falling' ? '↓ Falling' : '→ Stable'}
                        </td>
                      </tr>
                      <tr>
                        <td style={{ color: '#64748b', padding: '2px 0' }}>Confidence</td>
                        <td style={{ fontWeight: 600, textAlign: 'right' }}>{Math.round((hotspot.model_confidence ?? 0) * 100)}%</td>
                      </tr>
                      <tr>
                        <td colSpan={2} style={{ color: '#64748b', padding: '4px 0 2px', fontSize: 11 }}>
                          <strong>Crimes:</strong> {hotspot.predicted_crimes.map(c => c.replace('_', ' ')).join(', ')}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  {hotspot.primary_warning && (
                    <p style={{ fontSize: 12, margin: '6px 0 4px', color: '#c53030', borderTop: '1px solid #eee', paddingTop: 6 }}>
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

          {userLocation && (
            <Marker position={[userLocation.lat, userLocation.lon]} icon={sosUserIcon} />
          )}

          <FlyTo target={userLocation} />
        </MapContainer>

        {/* Risk legend */}
        <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md p-3 rounded-2xl shadow-lg border border-slate-200 z-[1000] space-y-1.5">
          {(['critical', 'high', 'medium', 'low'] as RiskClassification[]).map(level => (
            <div key={level} className="flex items-center gap-2 text-xs font-semibold capitalize">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: RISK_COLORS[level] }} />
              <span className="text-slate-700">{level}</span>
            </div>
          ))}
        </div>

        {/* SOS panic button — citizens only */}
        {isCitizen && sosPhase === 'idle' && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
            onClick={handleSOS}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000]"
            style={{ filter: 'drop-shadow(0 4px 24px rgba(239,68,68,0.55))' }}
            title="Send SOS emergency alert"
          >
            <div className="relative flex items-center justify-center">
              <span className="absolute w-20 h-20 rounded-full bg-red-500 opacity-20 animate-ping" />
              <span className="absolute w-16 h-16 rounded-full bg-red-500 opacity-30 animate-ping" style={{ animationDelay: '0.3s' }} />
              <div className="relative w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 transition-all flex flex-col items-center justify-center border-4 border-white shadow-2xl">
                <span className="text-white font-black text-lg leading-none tracking-wider">SOS</span>
                <span className="text-red-200 text-[9px] font-bold uppercase leading-none mt-0.5">Emergency</span>
              </div>
            </div>
          </motion.button>
        )}

        {/* SOS status overlay */}
        <AnimatePresence>
          {sosPhase !== 'idle' && (
            <motion.div
              key="sos-status"
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 40, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 280, damping: 24 }}
              className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1001] w-80 max-w-[calc(100%-2rem)]"
            >
              {(sosPhase === 'locating' || sosPhase === 'sending') && (
                <div className="bg-slate-900/95 backdrop-blur-xl border border-red-500/40 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-2xl">
                  <div className="w-11 h-11 rounded-full bg-red-600 flex items-center justify-center shrink-0 animate-pulse">
                    <span className="text-white font-black text-sm">SOS</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white font-bold text-sm">
                      {sosPhase === 'locating' ? 'Getting your location…' : 'Sending emergency alert…'}
                    </p>
                    <p className="text-slate-400 text-xs mt-0.5">
                      {sosPhase === 'locating' ? 'Please allow location access' : 'Police are being notified'}
                    </p>
                  </div>
                  <Loader2 className="w-5 h-5 text-red-400 animate-spin shrink-0" />
                </div>
              )}

              {sosPhase === 'success' && sosResult && (
                <div className="bg-slate-900/95 backdrop-blur-xl border border-green-500/40 rounded-2xl px-5 py-4 shadow-2xl">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full bg-green-600 flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-green-400 font-bold text-sm">SOS Alert Sent!</p>
                      <p className="text-slate-300 text-xs mt-0.5 leading-relaxed">
                        Police have been notified. Help is on the way. Stay calm.
                      </p>
                      {userLocation && (
                        <div className="flex items-center gap-1 mt-2 text-slate-500 text-xs">
                          <MapPin className="w-3 h-3" />
                          <span>{userLocation.lat.toFixed(4)}, {userLocation.lon.toFixed(4)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-700">
                    <span className="text-xs text-slate-500">Ref: {sosResult.id.toUpperCase()}</span>
                    <button onClick={resetSOS} className="text-xs text-slate-400 hover:text-white transition-colors font-medium">
                      Dismiss
                    </button>
                  </div>
                </div>
              )}

              {sosPhase === 'error' && (
                <div className="bg-slate-900/95 backdrop-blur-xl border border-red-500/40 rounded-2xl px-5 py-4 shadow-2xl">
                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                      <XCircle className="w-6 h-6 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-red-400 font-bold text-sm">Alert Failed</p>
                      <p className="text-slate-300 text-xs mt-0.5">{sosError || 'Could not send alert.'}</p>
                      <p className="text-amber-400 text-xs mt-1.5 font-bold">Call 112 immediately.</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button onClick={resetSOS} className="flex-1 text-xs text-slate-400 hover:text-white py-1.5">Dismiss</button>
                    <button
                      onClick={() => { resetSOS(); setTimeout(handleSOS, 100) }}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs font-bold py-1.5 px-3 rounded-xl"
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected hotspot info card */}
        <AnimatePresence>
          {selectedCity && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              className="absolute bottom-6 left-6 w-80 max-w-[calc(100%-3rem)] bg-white/98 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-200 p-6 z-[1000] max-h-80 overflow-y-auto"
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
                  <p className="text-xl font-bold text-slate-900">{Math.round((selectedCity.model_confidence || 0) * 100)}%</p>
                  <p className="text-xs text-slate-500">Confidence</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-slate-900">{selectedCity.crime_count.toLocaleString()}</p>
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
    </div>
  )
}
